use axum::{extract::Request, http::StatusCode, middleware::Next, response::IntoResponse};
use serde::Deserialize;

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

async fn validate_clerk_jwt(_token: &str) -> anyhow::Result<ClerkClaims> {
    // Phase 1: fetch JWKS from Clerk, validate RS256 JWT, cache JwkSet in Arc<RwLock<>>
    todo!("implement JWT validation against Clerk JWKS endpoint")
}
