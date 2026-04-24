use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use db::{
    auth::AuthContext,
    models::{CreateSiteRequest, Site, UpdateSiteRequest},
};
use serde::Serialize;
use sqlx::Row as _;
use uuid::Uuid;

use crate::{error::AppError, state::AppState};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_sites).post(create_site))
        .route(
            "/:site_id",
            get(get_site).put(update_site).delete(delete_site),
        )
        .route("/:site_id/integrations", get(get_integrations))
        .route("/:site_id/sync", axum::routing::post(sync_site))
}

#[derive(Serialize)]
struct IntegrationStatus {
    connected: bool,
}

#[derive(Serialize)]
struct IntegrationsResponse {
    ga4: IntegrationStatus,
    gsc: IntegrationStatus,
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

    // Lazily create the org row if the Clerk webhook hasn't fired yet
    sqlx::query(
        "INSERT INTO organisations (clerk_org_id, name, slug)
         VALUES ($1, $1, $1)
         ON CONFLICT (clerk_org_id) DO NOTHING",
    )
    .bind(&org_id)
    .execute(&state.db)
    .await?;

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

async fn get_integrations(
    State(state): State<AppState>,
    Extension(ctx): Extension<AuthContext>,
    Path((org_id, site_id)): Path<(String, Uuid)>,
) -> Result<Json<IntegrationsResponse>, AppError> {
    let authed_org = ctx.require_org_id()?;
    if !ctx.is_super_admin() && authed_org != org_id {
        return Err(AppError::Forbidden);
    }

    let rows = sqlx::query(
        "SELECT provider FROM integrations
         WHERE org_id = $1 AND site_id = $2 AND refresh_token IS NOT NULL",
    )
    .bind(&org_id)
    .bind(site_id)
    .fetch_all(&state.db)
    .await?;

    let ga4 = rows
        .iter()
        .any(|r| r.try_get::<String, _>("provider").ok().as_deref() == Some("ga4"));
    let gsc = rows
        .iter()
        .any(|r| r.try_get::<String, _>("provider").ok().as_deref() == Some("gsc"));

    Ok(Json(IntegrationsResponse {
        ga4: IntegrationStatus { connected: ga4 },
        gsc: IntegrationStatus { connected: gsc },
    }))
}

async fn sync_site(
    State(state): State<AppState>,
    Extension(ctx): Extension<AuthContext>,
    Path((org_id, site_id)): Path<(String, Uuid)>,
) -> Result<StatusCode, AppError> {
    let authed_org = ctx.require_org_id()?;
    if !ctx.is_super_admin() && authed_org != org_id {
        return Err(AppError::Forbidden);
    }

    let rows = sqlx::query(
        "SELECT i.id, i.provider, i.access_token, i.refresh_token, i.expires_at,
                s.ga4_property_id, s.gsc_site_url
         FROM integrations i
         JOIN sites s ON s.id = i.site_id
         WHERE i.org_id = $1 AND i.site_id = $2 AND i.refresh_token IS NOT NULL",
    )
    .bind(&org_id)
    .bind(site_id)
    .fetch_all(&state.db)
    .await?;

    for row in rows {
        use sqlx::Row as _;
        let id: Uuid = row.try_get("id").unwrap();
        let provider: String = row.try_get("provider").unwrap_or_default();
        let access_token: Option<String> = row.try_get("access_token").ok().flatten();
        let refresh_token: Option<String> = row.try_get("refresh_token").ok().flatten();
        let expires_at: Option<time::OffsetDateTime> = row.try_get("expires_at").ok().flatten();

        let token = match ingest::token::ensure_fresh_token(
            &state.db, id, access_token.as_deref(), refresh_token.as_deref(), expires_at,
        )
        .await
        {
            Ok(t) => t,
            Err(e) => {
                tracing::error!(site_id = %site_id, "token refresh failed: {e}");
                continue;
            }
        };

        match provider.as_str() {
            "ga4" => {
                let prop_id: Option<String> = row.try_get("ga4_property_id").ok().flatten();
                if let Some(ref p) = prop_id {
                    if let Err(e) = ingest::ga4::sync(&state.ch, &org_id, site_id, p, &token).await {
                        tracing::error!(site_id = %site_id, "ga4 sync error: {e}");
                    }
                }
            }
            "gsc" => {
                let site_url: Option<String> = row.try_get("gsc_site_url").ok().flatten();
                if let Some(ref u) = site_url {
                    if let Err(e) = ingest::gsc::sync(&state.ch, &org_id, site_id, u, &token).await {
                        tracing::error!(site_id = %site_id, "gsc sync error: {e}");
                    }
                }
            }
            _ => {}
        }
    }

    Ok(StatusCode::NO_CONTENT)
}
