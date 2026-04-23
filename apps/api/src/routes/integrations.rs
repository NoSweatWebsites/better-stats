use axum::{
    extract::{Extension, Path, Query, State},
    response::Redirect,
    routing::get,
    Router,
};
use db::auth::AuthContext;
use serde::Deserialize;
use uuid::Uuid;

use crate::{error::AppError, state::AppState};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/ga4", get(ga4_begin))
        .route("/gsc", get(gsc_begin))
}

// Fixed-path callbacks so Google OAuth redirect URIs can be static
pub fn callbacks() -> Router<AppState> {
    Router::new()
        .route("/callbacks/ga4", get(ga4_callback))
        .route("/callbacks/gsc", get(gsc_callback))
}

#[derive(Deserialize)]
pub struct OAuthBeginQuery {
    pub site_id: Uuid,
}

#[derive(Deserialize)]
pub struct OAuthCallbackQuery {
    pub code: String,
    pub state: String,
}

async fn ga4_begin(
    State(state): State<AppState>,
    Extension(ctx): Extension<AuthContext>,
    Path(org_id): Path<String>,
    Query(q): Query<OAuthBeginQuery>,
) -> Result<Redirect, AppError> {
    let authed_org = ctx.require_org_id()?;
    if !ctx.is_super_admin() && authed_org != org_id {
        return Err(AppError::Forbidden);
    }

    let url = ingest::ga4::begin_oauth(&state.db, &org_id, q.site_id).await?;
    Ok(Redirect::to(&url))
}

async fn ga4_callback(
    State(state): State<AppState>,
    Query(q): Query<OAuthCallbackQuery>,
) -> Result<Redirect, AppError> {
    ingest::ga4::handle_callback(&state.db, &q.code, &q.state).await?;
    Ok(Redirect::to("/dashboard"))
}

async fn gsc_begin(
    State(state): State<AppState>,
    Extension(ctx): Extension<AuthContext>,
    Path(org_id): Path<String>,
    Query(q): Query<OAuthBeginQuery>,
) -> Result<Redirect, AppError> {
    let authed_org = ctx.require_org_id()?;
    if !ctx.is_super_admin() && authed_org != org_id {
        return Err(AppError::Forbidden);
    }

    let url = ingest::gsc::begin_oauth(&state.db, &org_id, q.site_id).await?;
    Ok(Redirect::to(&url))
}

async fn gsc_callback(
    State(state): State<AppState>,
    Query(q): Query<OAuthCallbackQuery>,
) -> Result<Redirect, AppError> {
    ingest::gsc::handle_callback(&state.db, &q.code, &q.state).await?;
    Ok(Redirect::to("/dashboard"))
}
