use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use aes_gcm::aead::rand_core::RngCore;
use base64::{engine::general_purpose::STANDARD, Engine};

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
