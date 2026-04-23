use aes_gcm::aead::rand_core::RngCore;
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use sqlx::PgPool;
use uuid::Uuid;

fn cipher() -> anyhow::Result<Aes256Gcm> {
    let key_b64 = std::env::var("TOKEN_ENCRYPTION_KEY")
        .map_err(|_| anyhow::anyhow!("TOKEN_ENCRYPTION_KEY not set"))?;
    let key_bytes = STANDARD.decode(&key_b64)?;
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    Ok(Aes256Gcm::new(key))
}

pub fn encrypt(plaintext: &str) -> anyhow::Result<String> {
    let cipher = cipher()?;
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| anyhow::anyhow!("encryption failed: {e}"))?;

    let mut combined = nonce_bytes.to_vec();
    combined.extend_from_slice(&ciphertext);
    Ok(STANDARD.encode(&combined))
}

/// Returns the plaintext access token, refreshing via Google if it expires within 5 minutes.
/// Updates the DB with the new encrypted token and expiry if a refresh occurred.
pub async fn ensure_fresh_token(
    db: &PgPool,
    integration_id: Uuid,
    access_token_enc: Option<&str>,
    refresh_token_enc: Option<&str>,
    expires_at: Option<time::OffsetDateTime>,
) -> anyhow::Result<String> {
    let needs_refresh = expires_at
        .map(|exp| exp - time::OffsetDateTime::now_utc() < time::Duration::minutes(5))
        .unwrap_or(true);

    if !needs_refresh {
        let enc = access_token_enc.ok_or_else(|| anyhow::anyhow!("missing access_token"))?;
        return decrypt(enc);
    }

    let refresh_enc = refresh_token_enc.ok_or_else(|| anyhow::anyhow!("missing refresh_token"))?;
    let refresh_plain = decrypt(refresh_enc)?;

    let (new_access, new_expiry) = refresh_google_token(&refresh_plain).await?;

    let new_access_enc = encrypt(&new_access)?;
    sqlx::query!(
        "UPDATE integrations SET access_token = $1, expires_at = $2 WHERE id = $3",
        new_access_enc,
        new_expiry,
        integration_id
    )
    .execute(db)
    .await?;

    Ok(new_access)
}

async fn refresh_google_token(
    refresh_token: &str,
) -> anyhow::Result<(String, time::OffsetDateTime)> {
    let client_id = std::env::var("GOOGLE_OAUTH_CLIENT_ID")?;
    let client_secret = std::env::var("GOOGLE_OAUTH_CLIENT_SECRET")?;

    #[derive(serde::Deserialize)]
    struct TokenResp {
        access_token: String,
        expires_in: i64,
    }

    let resp: TokenResp = reqwest::Client::new()
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
        ])
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    let expiry = time::OffsetDateTime::now_utc() + time::Duration::seconds(resp.expires_in);
    Ok((resp.access_token, expiry))
}

pub fn decrypt(encoded: &str) -> anyhow::Result<String> {
    let cipher = cipher()?;
    let combined = STANDARD.decode(encoded)?;
    if combined.len() < 12 {
        anyhow::bail!("ciphertext too short");
    }
    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| anyhow::anyhow!("decryption failed: {e}"))?;

    Ok(String::from_utf8(plaintext)?)
}
