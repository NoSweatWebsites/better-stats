mod error;
mod routes;
mod state;

use axum::{middleware, routing::get, Router};
use db::auth::clerk_auth_middleware;
use sqlx::postgres::PgPoolOptions;
use state::AppState;
use std::net::SocketAddr;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();
    dotenvy::dotenv().ok();

    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let clickhouse_url =
        std::env::var("CLICKHOUSE_URL").unwrap_or_else(|_| "http://localhost:8123".into());
    let clickhouse_db = std::env::var("CLICKHOUSE_DB").unwrap_or_else(|_| "betterstats".into());

    let db = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await
        .expect("failed to connect to Postgres");

    sqlx::migrate!("../../migrations")
        .run(&db)
        .await
        .expect("failed to run migrations");

    let ch = clickhouse::Client::default()
        .with_url(&clickhouse_url)
        .with_database(&clickhouse_db);

    let state = AppState { db, ch };

    let app = Router::new()
        .route("/health", get(|| async { "ok" }))
        .nest("/api", routes::router())
        .layer(middleware::from_fn(clerk_auth_middleware))
        .with_state(state);

    let port: u16 = std::env::var("API_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("listening on {addr}");

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
