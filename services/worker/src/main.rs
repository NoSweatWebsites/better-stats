use sqlx::postgres::PgPoolOptions;
use tokio_cron_scheduler::{Job, JobScheduler};

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();
    dotenvy::dotenv().ok();

    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    let db = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("failed to connect to Postgres");

    let sched = JobScheduler::new().await.unwrap();

    let db_clone = db.clone();
    sched
        .add(
            Job::new_async("0 0 2 * * *", move |_, _| {
                let db = db_clone.clone();
                Box::pin(async move {
                    if let Err(e) = sync_all_orgs(&db).await {
                        tracing::error!("sync_all_orgs failed: {e}");
                    }
                })
            })
            .unwrap(),
        )
        .await
        .unwrap();

    tracing::info!("worker started — nightly sync scheduled at 02:00 UTC");
    sched.start().await.unwrap();
    tokio::signal::ctrl_c().await.unwrap();
    tracing::info!("worker shutting down");
}

async fn sync_all_orgs(db: &sqlx::PgPool) -> anyhow::Result<()> {
    let orgs = sqlx::query!(
        "SELECT DISTINCT o.clerk_org_id
         FROM organisations o
         JOIN integrations i ON i.org_id = o.clerk_org_id
         WHERE i.refresh_token IS NOT NULL"
    )
    .fetch_all(db)
    .await?;

    let mut set = tokio::task::JoinSet::new();

    for org in orgs {
        let db = db.clone();
        set.spawn(async move {
            if let Err(e) = sync_org(&db, &org.clerk_org_id).await {
                tracing::error!(org_id = %org.clerk_org_id, "sync failed: {e}");
            }
        });
    }

    while set.join_next().await.is_some() {}
    Ok(())
}

async fn sync_org(_db: &sqlx::PgPool, org_id: &str) -> anyhow::Result<()> {
    tracing::info!(org_id, "syncing org");
    // Phase 1 implementation: refresh tokens, pull GA4 + GSC data, write to ClickHouse
    Ok(())
}
