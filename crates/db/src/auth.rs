use axum::{extract::Request, http::StatusCode, middleware::Next, response::IntoResponse};
use jsonwebtoken::{
    decode, decode_header,
    jwk::{AlgorithmParameters, JwkSet},
    Algorithm, DecodingKey, Validation,
};
use serde::Deserialize;
use std::sync::OnceLock;
use tokio::sync::RwLock;

#[derive(Debug, Deserialize, Clone)]
pub struct ClerkClaims {
    pub sub: String,
    pub org_id: Option<String>,
    pub org_role: Option<String>,
    #[serde(rename = "publicMetadata")]
    pub public_metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone)]
pub enum AuthContext {
    SuperAdmin {
        user_id: String,
    },
    OrgUser {
        user_id: String,
        org_id: String,
        role: OrgRole,
    },
}

#[derive(Debug, Clone)]
pub enum OrgRole {
    Admin,
    Viewer,
}

impl AuthContext {
    pub fn org_id(&self) -> Option<&str> {
        match self {
            Self::OrgUser { org_id, .. } => Some(org_id),
            Self::SuperAdmin { .. } => None,
        }
    }

    pub fn require_org_id(&self) -> Result<&str, StatusCode> {
        self.org_id().ok_or(StatusCode::FORBIDDEN)
    }

    pub fn is_super_admin(&self) -> bool {
        matches!(self, Self::SuperAdmin { .. })
    }
}

struct JwksCache {
    jwks: Option<JwkSet>,
    fetched_at: Option<std::time::Instant>,
}

static JWKS_CACHE: OnceLock<RwLock<JwksCache>> = OnceLock::new();

fn jwks_cache() -> &'static RwLock<JwksCache> {
    JWKS_CACHE.get_or_init(|| {
        RwLock::new(JwksCache {
            jwks: None,
            fetched_at: None,
        })
    })
}

async fn get_jwks() -> anyhow::Result<JwkSet> {
    const TTL: std::time::Duration = std::time::Duration::from_secs(3600);

    {
        let cache = jwks_cache().read().await;
        if let (Some(jwks), Some(fetched_at)) = (&cache.jwks, cache.fetched_at) {
            if fetched_at.elapsed() < TTL {
                return Ok(jwks.clone());
            }
        }
    }

    let url = std::env::var("CLERK_JWKS_URL")
        .map_err(|_| anyhow::anyhow!("CLERK_JWKS_URL not set"))?;

    let jwks: JwkSet = reqwest::get(&url).await?.json().await?;

    let mut cache = jwks_cache().write().await;
    cache.jwks = Some(jwks.clone());
    cache.fetched_at = Some(std::time::Instant::now());

    Ok(jwks)
}

async fn validate_clerk_jwt(token: &str) -> anyhow::Result<ClerkClaims> {
    let header = decode_header(token)?;
    let kid = header
        .kid
        .ok_or_else(|| anyhow::anyhow!("JWT missing kid header"))?;

    let jwks = get_jwks().await?;
    let jwk = jwks
        .find(&kid)
        .ok_or_else(|| anyhow::anyhow!("no JWK matching kid={kid}"))?;

    let decoding_key = match &jwk.algorithm {
        AlgorithmParameters::RSA(rsa) => {
            DecodingKey::from_rsa_components(&rsa.n, &rsa.e)?
        }
        _ => anyhow::bail!("unsupported JWK algorithm"),
    };

    let mut validation = Validation::new(Algorithm::RS256);
    validation.validate_aud = false;

    let token_data = decode::<ClerkClaims>(token, &decoding_key, &validation)?;
    Ok(token_data.claims)
}

pub async fn clerk_auth_middleware(
    mut req: Request,
    next: Next,
) -> Result<impl IntoResponse, StatusCode> {
    let token = req
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let claims = validate_clerk_jwt(token)
        .await
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    let is_super_admin = claims
        .public_metadata
        .as_ref()
        .and_then(|m| m.get("role"))
        .and_then(|r| r.as_str())
        .map(|r| r == "super_admin")
        .unwrap_or(false);

    let ctx = if is_super_admin {
        AuthContext::SuperAdmin {
            user_id: claims.sub,
        }
    } else {
        let org_id = claims.org_id.ok_or(StatusCode::FORBIDDEN)?;
        let role = match claims.org_role.as_deref() {
            Some("org:admin") => OrgRole::Admin,
            _ => OrgRole::Viewer,
        };
        AuthContext::OrgUser {
            user_id: claims.sub,
            org_id,
            role,
        }
    };

    req.extensions_mut().insert(ctx);
    Ok(next.run(req).await)
}
