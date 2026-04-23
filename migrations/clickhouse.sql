-- Run these manually in ClickHouse (not via sqlx).
-- The API runs these on startup via the clickhouse client.

CREATE TABLE IF NOT EXISTS traffic_events (
    org_id          String,
    site_id         UUID,
    date            Date,
    channel         LowCardinality(String),
    sessions        UInt32,
    users           UInt32,
    pageviews       UInt32,
    conversions     UInt32,
    recorded_at     DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (org_id, site_id, date, channel)
PARTITION BY toYYYYMM(date);

CREATE TABLE IF NOT EXISTS seo_keywords (
    org_id          String,
    site_id         UUID,
    date            Date,
    keyword         String,
    clicks          UInt32,
    impressions     UInt32,
    position        Float32,
    ctr             Float32,
    recorded_at     DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (org_id, site_id, date)
PARTITION BY toYYYYMM(date);

CREATE TABLE IF NOT EXISTS snippet_events (
    site_id     UUID,
    org_id      String,
    event       LowCardinality(String),
    url         String,
    referrer    String,
    props       String,
    ts          DateTime64(3),
    recorded_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (site_id, recorded_at)
PARTITION BY toYYYYMM(recorded_at);
