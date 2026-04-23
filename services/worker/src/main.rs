#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    dotenvy::dotenv().ok();

    tracing::info!("worker started — awaiting jobs");

    tokio::signal::ctrl_c().await.unwrap();
    tracing::info!("worker shutting down");
}
