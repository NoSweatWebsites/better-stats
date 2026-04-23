use clickhouse::Client as ChClient;
use sqlx::postgres::PgPoolOptions;
use tokio_cron_scheduler::{Job, JobScheduler};

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();
    dotenvy::dotenv().ok();

    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let clickhouse_url =
        std::env::var("CLICKHOUSE_URL").unwrap_or_else(|_| "http://localhost:8123".into());
    let clickhouse_db = std::env::var("CLICKHOUSE_DB").unwrap_or_else(|_| "betterstats".into());

    let db = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("failed to connect to Postgres");

    let ch = ChClient::default()
        .with_url(&clickhouse_url)
        .with_database(&clickhouse_db);

    let sched = JobScheduler::new().await.unwrap();

    let db_clone = db.clone();
    let ch_clone = ch.clone();
    sched
        .add(
            Job::new_async("0 0 2 * * *", move |_, _| {
                let db = db_clone.clone();
                let ch = ch_clone.clone();
                Box::pin(async move {
                    if let Err(e) = sync_all_orgs(&db, &ch).await {
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

async fn sync_all_orgs(db: &sqlx::PgPool, ch: &ChClient) -> anyhow::Result<()> {
    let orgs = sqlx::query!(
        "SELECT DISTINCT o.clerk_org_id
         FROM organisations o
         JOIN integrations i ON i.org_id = o.clerk_org_id
         WHERE i.refresh_token IS NOT NULL"
    )
    .fetch_all(db)
    .await?;

    tracing::info!("syncing {} orgs", orgs.len());

    let mut set = tokio::task::JoinSet::new();

    for org in orgs {
        let db = db.clone();
        let ch = ch.clone();
        set.spawn(async move {
            if let Err(e) = sync_org(&db, &ch, &org.clerk_org_id).await {
                tracing::error!(org_id = %org.clerk_org_id, "sync failed: {e}");
            }
        });
    }

    while set.join_next().await.is_some() {}
    Ok(())
}

async fn sync_org(db: &sqlx::PgPool, ch: &ChClient, org_id: &str) -> anyhow::Result<()> {
    tracing::info!(org_id, "syncing org");

    let integrations = sqlx::query!(
        "SELECT i.id, i.provider, i.access_token, i.refresh_token, i.expires_at,
                s.id as site_id, s.ga4_property_id, s.gsc_site_url
         FROM integrations i
         JOIN sites s ON s.id = i.site_id
         WHERE i.org_id = $1 AND i.refresh_token IS NOT NULL",
        org_id
    )
    .fetch_all(db)
    .await?;

    for row in integrations {
        let access_token = match ingest::token::ensure_fresh_token(
            db,
            row.id,
            row.access_token.as_deref(),
            row.refresh_token.as_deref(),
            row.expires_at,
        )
        .await
        {
            Ok(t) => t,
            Err(e) => {
                tracing::error!(org_id, integration_id = %row.id, "token refresh failed: {e}");
                continue;
            }
        };

        match row.provider.as_str() {
            "ga4" => match row.ga4_property_id {
                Some(ref prop_id) => {
                    match ingest::ga4::sync(ch, org_id, row.site_id, prop_id, &access_token).await {
                        Ok(n) => {
                            tracing::info!(org_id, site_id = %row.site_id, rows = n, "ga4 sync done")
                        }
                        Err(e) => {
                            tracing::error!(org_id, site_id = %row.site_id, "ga4 sync error: {e}")
                        }
                    }
                }
                None => {
                    tracing::warn!(org_id, site_id = %row.site_id, "ga4 integration missing property_id")
                }
            },
            "gsc" => match row.gsc_site_url {
                Some(ref site_url) => {
                    match ingest::gsc::sync(ch, org_id, row.site_id, site_url, &access_token).await
                    {
                        Ok(n) => {
                            tracing::info!(org_id, site_id = %row.site_id, rows = n, "gsc sync done")
                        }
                        Err(e) => {
                            tracing::error!(org_id, site_id = %row.site_id, "gsc sync error: {e}")
                        }
                    }
                }
                None => {
                    tracing::warn!(org_id, site_id = %row.site_id, "gsc integration missing site_url")
                }
            },
            other => tracing::warn!(org_id, provider = other, "unknown provider"),
        }
    }

    Ok(())
}
