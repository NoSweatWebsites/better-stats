use axum::{
    extract::{Extension, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use db::{auth::AuthContext, models::Organisation};

use crate::{error::AppError, state::AppState};

pub fn router() -> Router<AppState> {
    Router::new().route("/orgs", get(list_orgs))
}

async fn list_orgs(
    State(state): State<AppState>,
    Extension(ctx): Extension<AuthContext>,
) -> Result<Json<Vec<Organisation>>, AppError> {
    if !ctx.is_super_admin() {
        return Err(AppError::Forbidden);
    }

    let orgs = sqlx::query_as!(
        Organisation,
        "SELECT clerk_org_id, name, slug, plan FROM organisations ORDER BY created_at DESC"
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(orgs))
}
