mod admin;
mod dashboard;
mod integrations;
mod sites;
pub mod webhooks;

use crate::state::AppState;
use axum::Router;

pub fn router() -> Router<AppState> {
    Router::new()
        .nest("/orgs/:org_id/sites", sites::router())
        .nest("/orgs/:org_id/integrations", integrations::router())
        .nest("/orgs/:org_id/dashboard", dashboard::router())
        .nest("/admin", admin::router())
}

// OAuth callbacks must be public — Google redirects the browser here with no Bearer token
pub fn callbacks() -> Router<AppState> {
    integrations::callbacks()
}
