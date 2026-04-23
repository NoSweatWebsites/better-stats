use oauth2::{
    basic::BasicClient, AuthUrl, AuthorizationCode, ClientId, ClientSecret, CsrfToken,
    PkceCodeChallenge, RedirectUrl, Scope, TokenUrl,
};
use oauth2::{reqwest::async_http_client, TokenResponse};
use sqlx::PgPool;
use uuid::Uuid;

use crate::token;

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
