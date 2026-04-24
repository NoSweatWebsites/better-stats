use oauth2::{
    basic::BasicClient, AuthUrl, AuthorizationCode, ClientId, ClientSecret, CsrfToken, RedirectUrl,
    Scope, TokenUrl,
};
use oauth2::{reqwest::async_http_client, TokenResponse};
use sqlx::{PgPool, Row as _};
use uuid::Uuid;

use clickhouse::Row;
use serde::Serialize;

use crate::token;

#[derive(Row, Serialize)]
struct SeoKeyword {
    org_id: String,
    site_id: uuid::Uuid,
    date: time::Date,
    keyword: String,
    clicks: u32,
    impressions: u32,
    position: f32,
    ctr: f32,
}

/// Pulls yesterday's GSC data for one site and writes rows to ClickHouse.
pub async fn sync(
    ch: &clickhouse::Client,
    org_id: &str,
    site_id: uuid::Uuid,
    site_url: &str,
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
        "startDate": date_str,
        "endDate": date_str,
        "dimensions": ["query"],
        "rowLimit": 25000
    });

    let encoded_url = urlencoding::encode(site_url);
    let resp: serde_json::Value = reqwest::Client::new()
        .post(format!(
            "https://searchconsole.googleapis.com/webmasters/v3/sites/{}/searchAnalytics/query",
            encoded_url
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

    let mut insert = ch.insert("seo_keywords")?;
    let mut count = 0usize;

    for row in rows {
        let keyword = row["keys"][0].as_str().unwrap_or("").to_string();
        let clicks = row["clicks"].as_f64().unwrap_or(0.0) as u32;
        let impressions = row["impressions"].as_f64().unwrap_or(0.0) as u32;
        let position = row["position"].as_f64().unwrap_or(0.0) as f32;
        let ctr = row["ctr"].as_f64().unwrap_or(0.0) as f32;

        insert
            .write(&SeoKeyword {
                org_id: org_id.to_string(),
                site_id,
                date: yesterday,
                keyword,
                clicks,
                impressions,
                position,
                ctr,
            })
            .await?;
        count += 1;
    }

    insert.end().await?;
    Ok(count)
}

const AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const SCOPE: &str = "https://www.googleapis.com/auth/webmasters.readonly";

fn make_client() -> anyhow::Result<BasicClient> {
    let client_id = std::env::var("GOOGLE_OAUTH_CLIENT_ID")?;
    let client_secret = std::env::var("GOOGLE_OAUTH_CLIENT_SECRET")?;
    let redirect_url = std::env::var("GSC_REDIRECT_URL")?;

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

    let (auth_url, csrf_token) = client
        .authorize_url(CsrfToken::new_random)
        .add_scope(Scope::new(SCOPE.into()))
        // offline access + prompt=consent ensures Google always returns a refresh token
        .add_extra_param("access_type", "offline")
        .add_extra_param("prompt", "consent")
        .url();

    sqlx::query!(
        "INSERT INTO integrations (org_id, site_id, provider, access_token)
         VALUES ($1, $2, 'gsc', $3)
         ON CONFLICT (site_id, provider) DO UPDATE SET access_token = $3",
        org_id,
        site_id,
        csrf_token.secret()
    )
    .execute(db)
    .await?;

    Ok(auth_url.to_string())
}

pub async fn handle_callback(db: &PgPool, code: &str, state: &str) -> anyhow::Result<Uuid> {
    let row = sqlx::query(
        "SELECT id, site_id FROM integrations WHERE provider = 'gsc' AND access_token = $1",
    )
    .bind(state)
    .fetch_one(db)
    .await?;

    let integration_id: Uuid = row.try_get("id")?;
    let site_id: Option<Uuid> = row.try_get("site_id")?;

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
        integration_id
    )
    .execute(db)
    .await?;

    site_id.ok_or_else(|| anyhow::anyhow!("integration missing site_id"))
}
