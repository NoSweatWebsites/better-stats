use axum::{
    body::Bytes,
    extract::State,
    http::{HeaderMap, StatusCode},
    routing::post,
    Router,
};
use serde::Deserialize;
use svix::webhooks::Webhook;

use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/clerk", post(clerk_webhook))
}

#[derive(Deserialize)]
struct ClerkEvent {
    #[serde(rename = "type")]
    event_type: String,
    data: serde_json::Value,
}

#[derive(Deserialize)]
struct OrgData {
    id: String,
    name: String,
    slug: String,
}

async fn clerk_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> StatusCode {
    let secret = match std::env::var("CLERK_WEBHOOK_SECRET") {
        Ok(s) => s,
        Err(_) => {
            tracing::error!("CLERK_WEBHOOK_SECRET not set");
            return StatusCode::INTERNAL_SERVER_ERROR;
        }
    };

    let wh = match Webhook::new(&secret) {
        Ok(w) => w,
        Err(e) => {
            tracing::error!("invalid webhook secret: {e}");
            return StatusCode::INTERNAL_SERVER_ERROR;
        }
    };

    if let Err(e) = wh.verify(&body, &headers) {
        tracing::warn!("clerk webhook signature invalid: {e}");
        return StatusCode::UNAUTHORIZED;
    }

    let event: ClerkEvent = match serde_json::from_slice(&body) {
        Ok(e) => e,
        Err(e) => {
            tracing::warn!("failed to parse clerk webhook body: {e}");
            return StatusCode::BAD_REQUEST;
        }
    };

    match event.event_type.as_str() {
        "organization.created" | "organization.updated" => {
            if let Ok(org) = serde_json::from_value::<OrgData>(event.data) {
                if let Err(e) = sqlx::query!(
                    "INSERT INTO organisations (clerk_org_id, name, slug)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (clerk_org_id) DO UPDATE SET name = $2, slug = $3",
                    org.id,
                    org.name,
                    org.slug
                )
                .execute(&state.db)
                .await
                {
                    tracing::error!(org_id = %org.id, "failed to upsert org: {e}");
                    return StatusCode::INTERNAL_SERVER_ERROR;
                }
            }
        }
        "organization.deleted" => {
            if let Some(id) = event.data.get("id").and_then(|v| v.as_str()) {
                if let Err(e) =
                    sqlx::query!("DELETE FROM organisations WHERE clerk_org_id = $1", id)
                        .execute(&state.db)
                        .await
                {
                    tracing::error!(org_id = id, "failed to delete org: {e}");
                    return StatusCode::INTERNAL_SERVER_ERROR;
                }
            }
        }
        _ => {}
    }

    StatusCode::OK
}
