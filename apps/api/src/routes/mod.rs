mod admin;
mod dashboard;
mod integrations;
mod sites;

use axum::Router;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .nest("/orgs/:org_id/sites", sites::router())
        .nest("/orgs/:org_id/integrations", integrations::router())
        .nest("/orgs/:org_id/dashboard", dashboard::router())
        .nest("/admin", admin::router())
        // Fixed-path OAuth callbacks (Google requires static redirect URIs)
        .merge(integrations::callbacks())
}
