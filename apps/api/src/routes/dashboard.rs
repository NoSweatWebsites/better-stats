use axum::{
    extract::{Extension, Path, Query, State},
    routing::get,
    Json, Router,
};
use db::auth::AuthContext;
use serde::{Deserialize, Serialize};

use crate::{error::AppError, state::AppState};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/traffic", get(traffic))
        .route("/seo", get(seo))
}

#[derive(Deserialize)]
pub struct DateRangeQuery {
    pub days: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, clickhouse::Row)]
pub struct TrafficRow {
    pub date: String,
    pub channel: String,
    pub sessions: u32,
    pub users: u32,
    pub pageviews: u32,
    pub conversions: u32,
}

#[derive(Debug, Serialize, Deserialize, clickhouse::Row)]
pub struct SeoRow {
    pub date: String,
    pub keyword: String,
    pub clicks: u32,
    pub impressions: u32,
    pub position: f32,
    pub ctr: f32,
}

async fn traffic(
    State(state): State<AppState>,
    Extension(ctx): Extension<AuthContext>,
    Path(org_id): Path<String>,
    Query(q): Query<DateRangeQuery>,
) -> Result<Json<Vec<TrafficRow>>, AppError> {
    let authed_org = ctx.require_org_id()?;
    if !ctx.is_super_admin() && authed_org != org_id {
        return Err(AppError::Forbidden);
    }

    let days = q.days.unwrap_or(30);

    let rows = state
        .ch
        .query(
            "SELECT toString(date) as date, channel, sum(sessions) as sessions,
                    sum(users) as users, sum(pageviews) as pageviews, sum(conversions) as conversions
             FROM traffic_events
             WHERE org_id = ? AND date >= today() - ?
             GROUP BY date, channel
             ORDER BY date DESC",
        )
        .bind(org_id)
        .bind(days)
        .fetch_all::<TrafficRow>()
        .await
        .map_err(|e| AppError::Internal(e.into()))?;

    Ok(Json(rows))
}

async fn seo(
    State(state): State<AppState>,
    Extension(ctx): Extension<AuthContext>,
    Path(org_id): Path<String>,
    Query(q): Query<DateRangeQuery>,
) -> Result<Json<Vec<SeoRow>>, AppError> {
    let authed_org = ctx.require_org_id()?;
    if !ctx.is_super_admin() && authed_org != org_id {
        return Err(AppError::Forbidden);
    }

    let days = q.days.unwrap_or(30);

    let rows = state
        .ch
        .query(
            "SELECT toString(date) as date, keyword,
                    sum(clicks) as clicks, sum(impressions) as impressions,
                    avg(position) as position, avg(ctr) as ctr
             FROM seo_keywords
             WHERE org_id = ? AND date >= today() - ?
             GROUP BY date, keyword
             ORDER BY impressions DESC
             LIMIT 100",
        )
        .bind(org_id)
        .bind(days)
        .fetch_all::<SeoRow>()
        .await
        .map_err(|e| AppError::Internal(e.into()))?;

    Ok(Json(rows))
}
