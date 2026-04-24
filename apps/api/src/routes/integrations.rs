use axum::{
    extract::{Extension, Path, Query, State},
    response::Redirect,
    routing::get,
    Json, Router,
};
use db::auth::AuthContext;
use serde::Deserialize;
use uuid::Uuid;

use crate::{error::AppError, state::AppState};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/ga4", get(ga4_begin))
        .route("/ga4/url", get(ga4_begin_url))
        .route("/gsc", get(gsc_begin))
        .route("/gsc/url", get(gsc_begin_url))
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

async fn ga4_begin_url(
    State(state): State<AppState>,
    Extension(ctx): Extension<AuthContext>,
    Path(org_id): Path<String>,
    Query(q): Query<OAuthBeginQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let authed_org = ctx.require_org_id()?;
    if !ctx.is_super_admin() && authed_org != org_id {
        return Err(AppError::Forbidden);
    }

    let url = ingest::ga4::begin_oauth(&state.db, &org_id, q.site_id).await?;
    Ok(Json(serde_json::json!({ "url": url })))
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

async fn gsc_begin_url(
    State(state): State<AppState>,
    Extension(ctx): Extension<AuthContext>,
    Path(org_id): Path<String>,
    Query(q): Query<OAuthBeginQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let authed_org = ctx.require_org_id()?;
    if !ctx.is_super_admin() && authed_org != org_id {
        return Err(AppError::Forbidden);
    }

    let url = ingest::gsc::begin_oauth(&state.db, &org_id, q.site_id).await?;
    Ok(Json(serde_json::json!({ "url": url })))
}

async fn ga4_callback(
    State(state): State<AppState>,
    Query(q): Query<OAuthCallbackQuery>,
) -> Result<Redirect, AppError> {
    let site_id = ingest::ga4::handle_callback(&state.db, &q.code, &q.state).await?;
    let web_url = std::env::var("WEB_URL").unwrap_or_else(|_| "http://localhost:3000".into());
    Ok(Redirect::to(&format!("{}/dashboard/{}/traffic", web_url, site_id)))
}

async fn gsc_callback(
    State(state): State<AppState>,
    Query(q): Query<OAuthCallbackQuery>,
) -> Result<Redirect, AppError> {
    let site_id = ingest::gsc::handle_callback(&state.db, &q.code, &q.state).await?;
    let web_url = std::env::var("WEB_URL").unwrap_or_else(|_| "http://localhost:3000".into());
    Ok(Redirect::to(&format!("{}/dashboard/{}/seo", web_url, site_id)))
}
