use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    routing::{delete, get, post, put},
    Json, Router,
};
use db::{
    auth::AuthContext,
    models::{CreateSiteRequest, Site, UpdateSiteRequest},
};
use uuid::Uuid;

use crate::{error::AppError, state::AppState};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_sites).post(create_site))
        .route(
            "/:site_id",
            get(get_site).put(update_site).delete(delete_site),
        )
}

async fn list_sites(
    State(state): State<AppState>,
    Extension(ctx): Extension<AuthContext>,
    Path(org_id): Path<String>,
) -> Result<Json<Vec<Site>>, AppError> {
    let authed_org = ctx.require_org_id()?;
    if !ctx.is_super_admin() && authed_org != org_id {
        return Err(AppError::Forbidden);
    }

    let sites = sqlx::query_as!(
        Site,
        "SELECT id, org_id, name, domain, api_key, ga4_property_id, gsc_site_url, snippet_installed
         FROM sites WHERE org_id = $1 ORDER BY created_at DESC",
        org_id
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(sites))
}

async fn create_site(
    State(state): State<AppState>,
    Extension(ctx): Extension<AuthContext>,
    Path(org_id): Path<String>,
    Json(body): Json<CreateSiteRequest>,
) -> Result<(StatusCode, Json<Site>), AppError> {
    let authed_org = ctx.require_org_id()?;
    if !ctx.is_super_admin() && authed_org != org_id {
        return Err(AppError::Forbidden);
    }

    let site = sqlx::query_as!(
        Site,
        "INSERT INTO sites (org_id, name, domain)
         VALUES ($1, $2, $3)
         RETURNING id, org_id, name, domain, api_key, ga4_property_id, gsc_site_url, snippet_installed",
        org_id,
        body.name,
        body.domain
    )
    .fetch_one(&state.db)
    .await?;

    Ok((StatusCode::CREATED, Json(site)))
}

async fn get_site(
    State(state): State<AppState>,
    Extension(ctx): Extension<AuthContext>,
    Path((org_id, site_id)): Path<(String, Uuid)>,
) -> Result<Json<Site>, AppError> {
    let authed_org = ctx.require_org_id()?;
    if !ctx.is_super_admin() && authed_org != org_id {
        return Err(AppError::Forbidden);
    }

    let site = sqlx::query_as!(
        Site,
        "SELECT id, org_id, name, domain, api_key, ga4_property_id, gsc_site_url, snippet_installed
         FROM sites WHERE id = $1 AND org_id = $2",
        site_id,
        org_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(site))
}

async fn update_site(
    State(state): State<AppState>,
    Extension(ctx): Extension<AuthContext>,
    Path((org_id, site_id)): Path<(String, Uuid)>,
    Json(body): Json<UpdateSiteRequest>,
) -> Result<Json<Site>, AppError> {
    let authed_org = ctx.require_org_id()?;
    if !ctx.is_super_admin() && authed_org != org_id {
        return Err(AppError::Forbidden);
    }

    let site = sqlx::query_as!(
        Site,
        "UPDATE sites SET
            name = COALESCE($3, name),
            ga4_property_id = COALESCE($4, ga4_property_id),
            gsc_site_url = COALESCE($5, gsc_site_url)
         WHERE id = $1 AND org_id = $2
         RETURNING id, org_id, name, domain, api_key, ga4_property_id, gsc_site_url, snippet_installed",
        site_id,
        org_id,
        body.name,
        body.ga4_property_id,
        body.gsc_site_url
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(site))
}

async fn delete_site(
    State(state): State<AppState>,
    Extension(ctx): Extension<AuthContext>,
    Path((org_id, site_id)): Path<(String, Uuid)>,
) -> Result<StatusCode, AppError> {
    let authed_org = ctx.require_org_id()?;
    if !ctx.is_super_admin() && authed_org != org_id {
        return Err(AppError::Forbidden);
    }

    let result = sqlx::query!(
        "DELETE FROM sites WHERE id = $1 AND org_id = $2",
        site_id,
        org_id
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(StatusCode::NO_CONTENT)
}
