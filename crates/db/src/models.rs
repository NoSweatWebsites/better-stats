use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Organisation {
    pub clerk_org_id: String,
    pub name: String,
    pub slug: String,
    pub plan: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub clerk_user_id: String,
    pub clerk_org_id: Option<String>,
    pub email: String,
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Site {
    pub id: Uuid,
    pub org_id: String,
    pub name: String,
    pub domain: String,
    pub api_key: String,
    pub ga4_property_id: Option<String>,
    pub gsc_site_url: Option<String>,
    pub snippet_installed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Integration {
    pub id: Uuid,
    pub org_id: String,
    pub site_id: Option<Uuid>,
    pub provider: String,
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSiteRequest {
    pub name: String,
    pub domain: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSiteRequest {
    pub name: Option<String>,
    pub ga4_property_id: Option<String>,
    pub gsc_site_url: Option<String>,
}
