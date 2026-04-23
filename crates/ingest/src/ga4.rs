use oauth2::{
    basic::BasicClient, AuthUrl, AuthorizationCode, ClientId, ClientSecret, CsrfToken,
    PkceCodeChallenge, RedirectUrl, Scope, TokenUrl,
};
use oauth2::{reqwest::async_http_client, TokenResponse};
use sqlx::PgPool;
use uuid::Uuid;

use clickhouse::Row;
use serde::Serialize;

use crate::token;

#[derive(Row, Serialize)]
struct TrafficEvent {
    org_id: String,
    site_id: uuid::Uuid,
    date: time::Date,
    channel: String,
    sessions: u32,
    users: u32,
    pageviews: u32,
    conversions: u32,
}

/// Pulls yesterday's GA4 data for one site and writes rows to ClickHouse.
pub async fn sync(
    ch: &clickhouse::Client,
    org_id: &str,
    site_id: uuid::Uuid,
    property_id: &str,
    access_token: &str,
) -> anyhow::Result<usize> {
    let yesterday = (time::OffsetDateTime::now_utc() - time::Duration::days(1)).date();
    let date_str = format!(
        "{}-{:02}-{:02}",
        yesterday.year(),
        yesterday.month() as u8,
        yesterday.day()
    );

    let body = serde_json::json!({
        "dateRanges": [{ "startDate": date_str, "endDate": date_str }],
        "dimensions": [
            { "name": "sessionDefaultChannelGrouping" },
            { "name": "sessionSource" }
        ],
        "metrics": [
            { "name": "sessions" },
            { "name": "totalUsers" },
            { "name": "screenPageViews" },
            { "name": "conversions" }
        ],
        "limit": 10000
    });

    let resp: serde_json::Value = reqwest::Client::new()
        .post(format!(
            "https://analyticsdata.googleapis.com/v1beta/properties/{}:runReport",
            property_id
        ))
        .bearer_auth(access_token)
        .json(&body)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    let rows = match resp["rows"].as_array() {
        Some(r) => r,
        None => return Ok(0),
    };

    let mut insert = ch.insert("traffic_events")?;
    let mut count = 0usize;

    for row in rows {
        let dims = row["dimensionValues"]
            .as_array()
            .map(Vec::as_slice)
            .unwrap_or(&[]);
        let metrics = row["metricValues"]
            .as_array()
            .map(Vec::as_slice)
            .unwrap_or(&[]);

        let channel_group = dims.first().and_then(|d| d["value"].as_str()).unwrap_or("");
        let source = dims.get(1).and_then(|d| d["value"].as_str()).unwrap_or("");
        let channel = classify_channel(channel_group, source);

        let parse = |i: usize| -> u32 {
            metrics
                .get(i)
                .and_then(|m| m["value"].as_str())
                .and_then(|v| v.parse().ok())
                .unwrap_or(0)
        };

        insert
            .write(&TrafficEvent {
                org_id: org_id.to_string(),
                site_id,
                date: yesterday,
                channel,
                sessions: parse(0),
                users: parse(1),
                pageviews: parse(2),
                conversions: parse(3),
            })
            .await?;
        count += 1;
    }

    insert.end().await?;
    Ok(count)
}

fn classify_channel(channel_group: &str, source: &str) -> String {
    if AI_REFERRERS.iter().any(|ai| source.contains(ai)) {
        return "ai".to_string();
    }
    match channel_group.to_lowercase().as_str() {
        s if s.contains("organic search") => "organic",
        s if s.contains("direct") => "direct",
        s if s.contains("referral") => "referral",
        s if s.contains("paid") => "paid",
        s if s.contains("social") => "social",
        s if s.contains("email") => "email",
        _ => "other",
    }
    .to_string()
}

const AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const SCOPE: &str = "https://www.googleapis.com/auth/analytics.readonly";

pub const AI_REFERRERS: &[&str] = &[
    "chat.openai.com",
    "chatgpt.com",
    "perplexity.ai",
    "gemini.google.com",
    "copilot.microsoft.com",
    "claude.ai",
    "you.com",
    "deepseek.com",
    "poe.com",
];

fn make_client() -> anyhow::Result<BasicClient> {
    let client_id = std::env::var("GOOGLE_OAUTH_CLIENT_ID")?;
    let client_secret = std::env::var("GOOGLE_OAUTH_CLIENT_SECRET")?;
    let redirect_url = std::env::var("GA4_REDIRECT_URL")?;

    Ok(BasicClient::new(
        ClientId::new(client_id),
        Some(ClientSecret::new(client_secret)),
        AuthUrl::new(AUTH_URL.into())?,
        Some(TokenUrl::new(TOKEN_URL.into())?),
    )
    .set_redirect_uri(RedirectUrl::new(redirect_url)?))
}

pub async fn begin_oauth(db: &PgPool, org_id: &str, site_id: Uuid) -> anyhow::Result<String> {
    let client = make_client()?;
    let (pkce_challenge, _pkce_verifier) = PkceCodeChallenge::new_random_sha256();

    let (auth_url, csrf_token) = client
        .authorize_url(CsrfToken::new_random)
        .add_scope(Scope::new(SCOPE.into()))
        .set_pkce_challenge(pkce_challenge)
        .url();

    // Store CSRF token temporarily so callback can look up org/site
    sqlx::query!(
        "INSERT INTO integrations (org_id, site_id, provider, access_token)
         VALUES ($1, $2, 'ga4', $3)
         ON CONFLICT (site_id, provider) DO UPDATE SET access_token = $3",
        org_id,
        site_id,
        csrf_token.secret()
    )
    .execute(db)
    .await?;

    Ok(auth_url.to_string())
}

pub async fn handle_callback(db: &PgPool, code: &str, state: &str) -> anyhow::Result<()> {
    let integration = sqlx::query!(
        "SELECT id, org_id, site_id FROM integrations
         WHERE provider = 'ga4' AND access_token = $1",
        state
    )
    .fetch_one(db)
    .await?;

    let client = make_client()?;
    let token = client
        .exchange_code(AuthorizationCode::new(code.into()))
        .request_async(async_http_client)
        .await
        .map_err(|e| anyhow::anyhow!("token exchange failed: {e}"))?;

    let access_token = token::encrypt(token.access_token().secret())?;
    let refresh_token = token
        .refresh_token()
        .map(|t| token::encrypt(t.secret()))
        .transpose()?;

    let expires_at = token
        .expires_in()
        .map(|d| time::OffsetDateTime::now_utc() + time::Duration::seconds(d.as_secs() as i64));

    sqlx::query!(
        "UPDATE integrations
         SET access_token = $1, refresh_token = $2, expires_at = $3
         WHERE id = $4",
        access_token,
        refresh_token,
        expires_at,
        integration.id
    )
    .execute(db)
    .await?;

    Ok(())
}
