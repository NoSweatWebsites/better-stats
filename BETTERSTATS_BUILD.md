# betterstats.io — Claude Code Build Instructions

> Full-stack SaaS analytics platform. Rust backend, Next.js frontend, Turborepo monorepo.
> Work through phases in order. Complete all tasks in a phase before moving to the next.
> Ask for clarification before making assumptions on schema or API design.

---

## Tech stack reference

| Layer | Choice |
|---|---|
| Monorepo | Turborepo |
| Backend language | Rust (stable) |
| HTTP framework | axum 0.7 |
| Async runtime | tokio (full features) |
| Database ORM | sqlx (async, compile-time checked) |
| Primary DB | Postgres + TimescaleDB |
| Analytics DB | ClickHouse |
| Cache / queues | Redis |
| Frontend | Next.js 14 (app router) |
| Auth | Clerk |
| Email | Resend |
| Hosting | Railway |
| CDN / DNS | Cloudflare |
| CI/CD | GitHub Actions |
| Error tracking | Sentry |
| Object storage | Cloudflare R2 |

---

## Repository structure (target)

```
betterstats/
├── apps/
│   ├── web/                        # Next.js dashboard
│   ├── api/                        # Rust axum HTTP server
│   └── snippet/                    # Vanilla TS tracking script → bs.js
├── packages/
│   ├── ui/                         # Shared React component library
│   ├── sdk/                        # @betterstats/sdk (Phase 3)
│   ├── typescript-config/          # Shared tsconfig bases
│   └── eslint-config/              # Shared ESLint rules
├── services/
│   └── worker/                     # Rust background worker (no HTTP)
├── crates/
│   ├── db/                         # Shared sqlx models + migrations
│   ├── ingest/                     # GA4, GSC, AEO ingestion logic
│   └── analytics/                  # Metrics calculations
├── migrations/                     # sqlx migration files
├── .github/
│   └── workflows/
│       └── ci.yml
├── turbo.json
├── package.json                    # Root workspace
└── Cargo.toml                      # Rust workspace root
```

---

## Phase 0 — Monorepo + infrastructure setup

**Goal:** Working repo, CI pipeline, and Railway services. No application code yet.

### 0.1 Initialise the Turborepo workspace

```bash
npx create-turbo@latest betterstats --package-manager pnpm
cd betterstats
```

Create the full directory structure above. Remove any Turbo starter app boilerplate.

**Root `package.json`:**
```json
{
  "name": "betterstats",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "workspaces": ["apps/*", "packages/*", "services/*"],
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "type-check": "turbo run type-check"
  },
  "devDependencies": {
    "turbo": "latest"
  }
}
```

**`turbo.json`:**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**", "target/release/**"]
    },
    "build:api": {
      "cache": true,
      "outputs": ["target/release/api"]
    },
    "build:worker": {
      "cache": true,
      "outputs": ["target/release/worker"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": { "outputs": [] },
    "test": { "dependsOn": ["^build"], "outputs": [] },
    "type-check": { "dependsOn": ["^build"], "outputs": [] }
  }
}
```

### 0.2 Rust workspace

**Root `Cargo.toml`:**
```toml
[workspace]
members = [
    "apps/api",
    "services/worker",
    "crates/db",
    "crates/ingest",
    "crates/analytics",
]
resolver = "2"

[workspace.dependencies]
tokio       = { version = "1", features = ["full"] }
axum        = "0.7"
sqlx        = { version = "0.7", features = ["postgres", "uuid", "time", "runtime-tokio", "macros"] }
serde       = { version = "1", features = ["derive"] }
serde_json  = "1"
uuid        = { version = "1", features = ["v4", "serde"] }
anyhow      = "1"
thiserror   = "1"
tracing     = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
reqwest     = { version = "0.11", features = ["json", "rustls-tls"], default-features = false }
dotenvy     = "0.15"
```

Each Rust app/crate should reference workspace deps: `tokio = { workspace = true }`.

### 0.3 Wrap Rust builds for Turbo

**`apps/api/package.json`:**
```json
{
  "name": "@betterstats/api",
  "scripts": {
    "build": "cargo build --release -p api",
    "dev": "cargo watch -x 'run -p api'",
    "test": "cargo test -p api",
    "lint": "cargo clippy -p api -- -D warnings"
  }
}
```

**`services/worker/package.json`:**
```json
{
  "name": "@betterstats/worker",
  "scripts": {
    "build": "cargo build --release -p worker",
    "dev": "cargo watch -x 'run -p worker'",
    "test": "cargo test -p worker",
    "lint": "cargo clippy -p worker -- -D warnings"
  }
}
```

### 0.4 GitHub Actions CI

**`.github/workflows/ci.yml`:**
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  rust:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          components: clippy, rustfmt
      - uses: Swatinem/rust-cache@v2
      - run: cargo fmt --all -- --check
      - run: cargo clippy --all-targets -- -D warnings
      - run: cargo test --all

  nextjs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - run: pnpm turbo run build lint type-check

  deploy:
    needs: [rust, nextjs]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: railwayapp/railway-action@v1
        with:
          service: api
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

### 0.5 Dockerfiles

**`apps/api/Dockerfile`** (multi-stage, final image ~10MB):
```dockerfile
FROM rust:1.76-slim AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY crates/ ./crates/
COPY apps/api/ ./apps/api/
COPY services/worker/ ./services/worker/
RUN cargo build --release -p api

FROM gcr.io/distroless/cc-debian12
COPY --from=builder /app/target/release/api /api
EXPOSE 8080
CMD ["/api"]
```

**`services/worker/Dockerfile`:**
```dockerfile
FROM rust:1.76-slim AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY crates/ ./crates/
COPY apps/api/ ./apps/api/
COPY services/worker/ ./services/worker/
RUN cargo build --release -p worker

FROM gcr.io/distroless/cc-debian12
COPY --from=builder /app/target/release/worker /worker
CMD ["/worker"]
```

### 0.6 Environment variables

Create `.env.example` at root. Never commit `.env`.

```bash
# Postgres
DATABASE_URL=postgresql://user:password@localhost:5432/betterstats

# ClickHouse
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_DB=betterstats

# Redis
REDIS_URL=redis://localhost:6379

# Clerk
CLERK_SECRET_KEY=sk_...
CLERK_PUBLISHABLE_KEY=pk_...
CLERK_JWKS_URL=https://your-domain.clerk.accounts.dev/.well-known/jwks.json

# Resend
RESEND_API_KEY=re_...

# Sentry
SENTRY_DSN=https://...

# App
APP_ENV=development
API_PORT=8080
```

### 0.7 Railway setup

- Create a new Railway project called `betterstats`
- Add services: `api`, `worker`, `web`, `postgres`, `redis`
- Add ClickHouse as a Docker service using `clickhouse/clickhouse-server:latest`
- Set all env vars from `.env.example` in Railway dashboard
- Link GitHub repo, enable auto-deploy on push to `main`

### Phase 0 done when:
- [ ] `pnpm turbo run build` completes without errors
- [ ] `cargo test --all` passes
- [ ] GitHub Actions CI is green
- [ ] Railway services are running (even with placeholder code)

---

## Phase 1 — Auth, multi-tenancy + cloud data ingestion

**Goal:** Clients can sign up, connect GA4/GSC, and see real traffic + SEO data in the dashboard.

### 1.1 Database schema (Postgres)

Create migration files in `migrations/`. Run with `sqlx migrate run`.

**`migrations/001_organisations.sql`:**
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE organisations (
    clerk_org_id    TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    slug            TEXT UNIQUE NOT NULL,
    plan            TEXT NOT NULL DEFAULT 'internal',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id   TEXT UNIQUE NOT NULL,
    clerk_org_id    TEXT REFERENCES organisations(clerk_org_id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    role            TEXT NOT NULL CHECK (role IN ('super_admin', 'org_admin', 'viewer')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sites (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              TEXT NOT NULL REFERENCES organisations(clerk_org_id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    domain              TEXT NOT NULL,
    api_key             TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    ga4_property_id     TEXT,
    gsc_site_url        TEXT,
    snippet_installed   BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE integrations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          TEXT NOT NULL REFERENCES organisations(clerk_org_id) ON DELETE CASCADE,
    site_id         UUID REFERENCES sites(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL CHECK (provider IN ('ga4', 'gsc')),
    access_token    TEXT,
    refresh_token   TEXT,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(site_id, provider)
);

CREATE INDEX idx_sites_org_id ON sites(org_id);
CREATE INDEX idx_integrations_org_id ON integrations(org_id);
```

### 1.2 Rust auth middleware (axum)

**`crates/db/src/auth.rs`:**

```rust
use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::IntoResponse,
};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm, jwk::JwkSet};
use serde::Deserialize;

#[derive(Debug, Deserialize, Clone)]
pub struct ClerkClaims {
    pub sub: String,
    pub org_id: Option<String>,
    pub org_role: Option<String>,
    #[serde(rename = "publicMetadata")]
    pub public_metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone)]
pub enum AuthContext {
    SuperAdmin { user_id: String },
    OrgUser {
        user_id: String,
        org_id: String,
        role: OrgRole,
    },
}

#[derive(Debug, Clone)]
pub enum OrgRole {
    Admin,
    Viewer,
}

impl AuthContext {
    pub fn org_id(&self) -> Option<&str> {
        match self {
            Self::OrgUser { org_id, .. } => Some(org_id),
            Self::SuperAdmin { .. } => None,
        }
    }

    pub fn require_org_id(&self) -> Result<&str, StatusCode> {
        self.org_id().ok_or(StatusCode::FORBIDDEN)
    }
}

pub async fn clerk_auth_middleware(
    mut req: Request,
    next: Next,
) -> Result<impl IntoResponse, StatusCode> {
    let token = req
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let claims = validate_clerk_jwt(token)
        .await
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    let is_super_admin = claims
        .public_metadata
        .as_ref()
        .and_then(|m| m.get("role"))
        .and_then(|r| r.as_str())
        .map(|r| r == "super_admin")
        .unwrap_or(false);

    let ctx = if is_super_admin {
        AuthContext::SuperAdmin { user_id: claims.sub }
    } else {
        let org_id = claims.org_id.ok_or(StatusCode::FORBIDDEN)?;
        let role = match claims.org_role.as_deref() {
            Some("org:admin") => OrgRole::Admin,
            _ => OrgRole::Viewer,
        };
        AuthContext::OrgUser {
            user_id: claims.sub,
            org_id,
            role,
        }
    };

    req.extensions_mut().insert(ctx);
    Ok(next.run(req).await)
}

async fn validate_clerk_jwt(token: &str) -> anyhow::Result<ClerkClaims> {
    // Fetch JWKS from Clerk and validate — cache keys in production
    // Use jsonwebtoken crate with RS256 algorithm
    // Implementation detail: cache the JwkSet in a global Arc<RwLock<JwkSet>>
    // refreshed every 1 hour
    todo!("implement JWT validation against Clerk JWKS endpoint")
}
```

### 1.3 Axum router structure

**`apps/api/src/main.rs`:**

```rust
use axum::{Router, middleware};
use std::net::SocketAddr;

mod routes;

#[tokio::main]
async fn main() {
    tracing_subscriber::init();

    let db_pool = /* sqlx::PgPool::connect from DATABASE_URL */;
    let ch_client = /* ClickHouse client */;

    let app = Router::new()
        .nest("/api", routes::router())
        .layer(middleware::from_fn(crate::auth::clerk_auth_middleware))
        .with_state(AppState { db_pool, ch_client });

    let addr = SocketAddr::from(([0, 0, 0, 0], 8080));
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}
```

**`apps/api/src/routes/mod.rs`** — organise routes by module:

```
/api/orgs/:org_id/sites              GET, POST
/api/orgs/:org_id/sites/:site_id     GET, PUT, DELETE
/api/orgs/:org_id/integrations/ga4   POST (begin OAuth)
/api/orgs/:org_id/integrations/ga4/callback  GET
/api/orgs/:org_id/integrations/gsc   POST
/api/orgs/:org_id/integrations/gsc/callback  GET
/api/orgs/:org_id/dashboard/traffic  GET
/api/orgs/:org_id/dashboard/seo      GET
/api/admin/orgs                      GET (super admin only)
```

All routes must extract `AuthContext` from extensions and validate `org_id` matches the path param, or is super admin.

### 1.4 GA4 + GSC OAuth integration

**`crates/ingest/src/ga4.rs`:**

- Use `oauth2` crate for the OAuth2 PKCE flow
- Scopes needed: `https://www.googleapis.com/auth/analytics.readonly`
- Store `access_token` and `refresh_token` encrypted in `integrations` table
- Use `aes-gcm` crate for token encryption with a `TOKEN_ENCRYPTION_KEY` env var

**`crates/ingest/src/gsc.rs`:**

- Scope: `https://www.googleapis.com/auth/webmasters.readonly`
- Same OAuth pattern as GA4

### 1.5 Worker: nightly sync jobs

**`services/worker/src/main.rs`:**

```rust
use tokio_cron_scheduler::{JobScheduler, Job};

#[tokio::main]
async fn main() {
    let sched = JobScheduler::new().await.unwrap();

    // Run at 2am UTC daily
    sched.add(Job::new_async("0 0 2 * * *", |_, _| {
        Box::pin(async {
            sync_all_orgs().await;
        })
    }).unwrap()).await.unwrap();

    sched.start().await.unwrap();
    tokio::signal::ctrl_c().await.unwrap();
}

async fn sync_all_orgs() {
    // 1. Fetch all orgs with active integrations from Postgres
    // 2. Fan out with JoinSet — one task per org
    // 3. Each task: refresh OAuth token if needed, pull GA4 + GSC data, write to ClickHouse
    let mut set = tokio::task::JoinSet::new();
    for org in get_active_orgs().await {
        set.spawn(async move { sync_org(org).await });
    }
    while let Some(res) = set.join_next().await {
        if let Err(e) = res { tracing::error!("sync failed: {e}"); }
    }
}
```

### 1.6 ClickHouse schema

```sql
CREATE TABLE traffic_events (
    org_id          String,
    site_id         UUID,
    date            Date,
    channel         LowCardinality(String),  -- 'organic', 'direct', 'referral', 'ai', 'paid'
    sessions        UInt32,
    users           UInt32,
    pageviews       UInt32,
    conversions     UInt32,
    recorded_at     DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (org_id, site_id, date, channel)
PARTITION BY toYYYYMM(date);

CREATE TABLE seo_keywords (
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
```

### 1.7 GA4 AI traffic detection

When syncing GA4 referral data, classify sessions from these domains as `channel = 'ai'`:

```rust
const AI_REFERRERS: &[&str] = &[
    "chat.openai.com",
    "chatgpt.com",
    "perplexity.ai",
    "gemini.google.com",
    "copilot.microsoft.com",
    "claude.ai",
    "you.com",
    "deepseek.com",
    "poe.com",
];
```

### 1.8 Next.js app setup

```bash
cd apps/web
npx create-next-app@latest . --typescript --tailwind --app --src-dir
pnpm add @clerk/nextjs
```

**Key files to create:**
- `src/app/layout.tsx` — wrap with `<ClerkProvider>`
- `src/middleware.ts` — Clerk auth middleware protecting `/dashboard/*`
- `src/app/(auth)/sign-in/page.tsx` — Clerk `<SignIn />` component
- `src/app/dashboard/layout.tsx` — sidebar with module nav + org switcher
- `src/app/dashboard/[siteId]/traffic/page.tsx`
- `src/app/dashboard/[siteId]/seo/page.tsx`

All API calls to Rust backend:
```typescript
const { getToken } = useAuth()
const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orgs/${orgId}/dashboard/traffic`, {
  headers: { Authorization: `Bearer ${await getToken()}` }
})
```

### Phase 1 done when:
- [ ] User can sign up via Clerk, create an org
- [ ] OAuth connect GA4 and GSC
- [ ] Nightly worker syncs real data
- [ ] Dashboard shows traffic by channel and GSC keywords
- [ ] Super admin can view any org's data
- [ ] All API routes enforce `org_id` scoping

---

## Phase 2 — AEO module + JS snippet + conversions

**Goal:** AEO visibility tracking live, JS snippet deployed, conversion data flowing.

### 2.1 ClickHouse: AEO citations table

```sql
CREATE TABLE aeo_citations (
    org_id          String,
    site_id         UUID,
    query_id        UUID,
    query_text      String,
    engine          LowCardinality(String),  -- 'chatgpt', 'perplexity', 'gemini', 'copilot'
    domain_cited    String,
    brand_mentioned Bool,
    brand_cited     Bool,
    sentiment       Float32,                 -- -1.0 to 1.0
    position        UInt8,                   -- position in answer (0 = not present)
    answer_snippet  String,
    recorded_at     DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (org_id, site_id, recorded_at, engine)
PARTITION BY toYYYYMM(recorded_at);

CREATE TABLE aeo_queries (
    id              UUID DEFAULT generateUUIDv4(),
    org_id          String,
    site_id         UUID,
    query_text      String,
    source          LowCardinality(String),  -- 'manual', 'gsc_derived'
    is_active       Bool DEFAULT true,
    created_at      DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (org_id, site_id);
```

### 2.2 AEO query runner

**`crates/ingest/src/aeo.rs`:**

```rust
use tokio::task::JoinSet;

pub struct AeoRunner {
    pub openai_key: String,
    pub perplexity_key: String,
    pub gemini_key: String,
}

impl AeoRunner {
    pub async fn run_batch(&self, queries: Vec<AeoQuery>) -> Vec<AeoResult> {
        let mut set = JoinSet::new();

        for query in queries {
            for engine in &["perplexity", "chatgpt", "gemini"] {
                let runner = self.clone();
                let q = query.clone();
                let e = engine.to_string();
                set.spawn(async move {
                    runner.run_single(&q, &e).await
                });
            }
        }

        let mut results = vec![];
        while let Some(Ok(Ok(r))) = set.join_next().await {
            results.push(r);
        }
        results
    }

    async fn run_single(&self, query: &AeoQuery, engine: &str) -> anyhow::Result<AeoResult> {
        let raw_answer = match engine {
            "perplexity" => self.query_perplexity(&query.text).await?,
            "chatgpt"    => self.query_openai(&query.text).await?,
            "gemini"     => self.query_gemini(&query.text).await?,
            _            => anyhow::bail!("unknown engine"),
        };

        Ok(parse_answer(raw_answer, query, engine))
    }
}

fn parse_answer(answer: String, query: &AeoQuery, engine: &str) -> AeoResult {
    // 1. Extract all URLs/domains cited in the answer
    // 2. Check if client's domain is mentioned or cited
    // 3. Determine position (1st mention = position 1, etc.)
    // 4. Use secondary Claude API call for sentiment analysis
    // 5. Return structured AeoResult
    todo!()
}
```

**GSC-derived query generation** — auto-generate AEO prompts from top GSC keywords:

```rust
pub async fn derive_queries_from_gsc(
    org_id: &str,
    site_id: Uuid,
    ch: &ClickHouseClient,
) -> Vec<String> {
    // Pull top 50 keywords by impressions from seo_keywords table
    // Transform: "best project management software" → "What is the best project management software?"
    // Filter: skip branded queries, skip navigational queries
    // Return as prompt strings
    todo!()
}
```

### 2.3 AEO metrics calculation

**`crates/analytics/src/aeo.rs`** — implement these metrics:

```rust
pub struct AeoMetrics {
    pub citation_rate: f32,        // % of queries where brand is cited
    pub share_of_voice: f32,       // brand citations / total citations across tracked domains
    pub visibility_score: f32,     // weighted by query volume + position
    pub avg_sentiment: f32,        // mean sentiment across all answers mentioning brand
    pub gap_queries: Vec<String>,  // queries where competitors cited but not you
}
```

### 2.4 AI Overview tracking (Google SERP)

Add a separate worker job that:
1. Takes the client's tracked keywords
2. Performs Google searches (use `serpapi` or `valueserp` API)
3. Detects if an AI Overview block is present in the SERP
4. Checks if the client's domain is cited in the AI Overview
5. Records position and competitor domains also cited

Store in a separate `google_ai_overviews` ClickHouse table.

### 2.5 Claude API content recommendations

**`crates/analytics/src/recommendations.rs`:**

When gap analysis identifies queries where competitors are cited but the client isn't, use the Anthropic API to generate specific content recommendations:

```rust
pub async fn generate_recommendations(
    gap_queries: &[GapQuery],
    client_domain: &str,
) -> Vec<ContentRecommendation> {
    let prompt = format!(
        "You are an AEO specialist. For the domain {client_domain}, \
         the following queries cite competitors but not this site: \n{}\n\
         For each query, provide specific, actionable content recommendations \
         to improve AI engine visibility. Return JSON.",
        format_gap_queries(gap_queries)
    );

    // POST to https://api.anthropic.com/v1/messages
    // Model: claude-sonnet-4-20250514
    // Parse response as Vec<ContentRecommendation>
    todo!()
}
```

### 2.6 JS snippet (`apps/snippet`)

**`apps/snippet/package.json`:**
```json
{
  "name": "@betterstats/snippet",
  "scripts": {
    "build": "tsup src/index.ts --format iife --global-name bs --out-dir dist --minify",
    "dev": "tsup src/index.ts --format iife --global-name bs --out-dir dist --watch"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.0.0"
  }
}
```

**`apps/snippet/src/index.ts`:**

```typescript
const INGEST_URL = 'https://ingest.betterstats.io/e'

interface BetterStats {
  siteId: string
  track: (event: string, props?: Record<string, unknown>) => void
  page: () => void
}

function init(): BetterStats {
  const siteId = (window as any).bs?.siteId
  if (!siteId) {
    console.warn('[betterstats] no siteId configured')
  }

  const send = (event: string, props: Record<string, unknown> = {}) => {
    const payload = {
      site_id: siteId,
      event,
      props,
      url: window.location.href,
      referrer: document.referrer,
      ua: navigator.userAgent,
      ts: Date.now(),
    }
    // Use sendBeacon for reliability, fallback to fetch
    if (navigator.sendBeacon) {
      navigator.sendBeacon(INGEST_URL, JSON.stringify(payload))
    } else {
      fetch(INGEST_URL, { method: 'POST', body: JSON.stringify(payload), keepalive: true })
    }
  }

  // Auto page view on load
  send('pageview')

  // Listen for SPA navigation (Next.js / React Router)
  let lastUrl = window.location.href
  new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href
      send('pageview')
    }
  }).observe(document, { subtree: true, childList: true })

  return {
    siteId,
    track: send,
    page: () => send('pageview'),
  }
}

;(window as any).bs = { ...(window as any).bs, ...init() }
```

**Ingest endpoint in Rust API:**

```rust
// POST /ingest/e — no auth required, rate limited by IP + site_id
pub async fn ingest_event(
    State(state): State<AppState>,
    Json(payload): Json<IngestPayload>,
) -> StatusCode {
    // 1. Validate site_id exists in Postgres
    // 2. Write to ClickHouse snippet_events table
    // 3. If first event for this site_id, flip sites.snippet_installed = true
    // 4. Return 200 immediately (fire and forget into background task)
    StatusCode::OK
}
```

**ClickHouse snippet_events table:**
```sql
CREATE TABLE snippet_events (
    site_id     UUID,
    org_id      String,
    event       LowCardinality(String),
    url         String,
    referrer    String,
    props       String,   -- JSON blob
    ts          DateTime64(3),
    recorded_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (site_id, recorded_at)
PARTITION BY toYYYYMM(recorded_at);
```

Deploy `dist/bs.js` to Cloudflare R2 behind `cdn.betterstats.io`.

### 2.7 Conversions module

Combine snippet events + GA4 conversion data:

- Per-page conversion rate = `conversions / pageviews` from snippet_events
- AI traffic conversions = sessions from AI referrers (from GA4) that complete a goal event
- Surface in dashboard: "Which pages convert AI traffic best?"

### 2.8 AEO dashboard views

Add to Next.js dashboard:

- `src/app/dashboard/[siteId]/aeo/page.tsx` — overview: visibility score, citation rate, share of voice trend
- `src/app/dashboard/[siteId]/aeo/queries/page.tsx` — per-query breakdown
- `src/app/dashboard/[siteId]/aeo/competitors/page.tsx` — competitor benchmark
- `src/app/dashboard/[siteId]/aeo/recommendations/page.tsx` — Claude-generated recommendations

### Phase 2 done when:
- [ ] AEO worker runs daily, queries ChatGPT/Perplexity/Gemini
- [ ] Citation rate, share of voice, gap analysis all calculated
- [ ] `bs.js` snippet live on CDN, clients can install
- [ ] Snippet events flowing into ClickHouse
- [ ] Conversion per page tracked
- [ ] Claude recommendations generated for gap queries
- [ ] All AEO views live in dashboard

---

## Phase 3 — Links module, NPM SDK + SaaS readiness

**Goal:** Full feature set, public-ready, Stripe billing wired.

### 3.1 Links module

**`crates/ingest/src/links.rs`:**

- Integrate Ahrefs API: `GET https://apiv2.ahrefs.com/?target={domain}&mode=domain&output=json`
- Store backlinks in ClickHouse `backlinks` table (domain, anchor, url, dr, first_seen, last_seen)
- Daily sync job per org, same pattern as GA4 sync
- Surface: new links, lost links, top linking domains, anchor text distribution

**ClickHouse backlinks table:**
```sql
CREATE TABLE backlinks (
    org_id          String,
    site_id         UUID,
    source_domain   String,
    source_url      String,
    target_url      String,
    anchor_text     String,
    domain_rating   Float32,
    first_seen      Date,
    last_seen       Date,
    recorded_at     DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(recorded_at)
ORDER BY (org_id, site_id, source_url, target_url);
```

### 3.2 NPM SDK (`packages/sdk`)

**`packages/sdk/package.json`:**
```json
{
  "name": "@betterstats/sdk",
  "version": "0.1.0",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "import": "./dist/index.mjs", "require": "./dist/index.js" },
    "./react": { "import": "./dist/react.mjs", "require": "./dist/react.js" },
    "./node": { "import": "./dist/node.mjs", "require": "./dist/node.js" }
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch"
  }
}
```

**`packages/sdk/src/index.ts`** — core client (same ingest endpoint as snippet):

```typescript
export class BetterStats {
  constructor(private opts: { siteId: string; secret?: string }) {}

  async track(event: string, props?: Record<string, unknown>): Promise<void> {
    await fetch('https://ingest.betterstats.io/e', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site_id: this.opts.siteId, event, props }),
    })
  }
}
```

**`packages/sdk/src/react.tsx`** — React hooks:
```typescript
import { createContext, useContext } from 'react'
import { BetterStats } from './index'

const BetterStatsContext = createContext<BetterStats | null>(null)

export function BetterStatsProvider({ siteId, children }: { siteId: string, children: React.ReactNode }) {
  const client = new BetterStats({ siteId })
  return <BetterStatsContext.Provider value={client}>{children}</BetterStatsContext.Provider>
}

export function useBetterStats() {
  const client = useContext(BetterStatsContext)
  if (!client) throw new Error('useBetterStats must be used within BetterStatsProvider')
  return client
}
```

**`packages/sdk/src/node.ts`** — server-side:
```typescript
export { BetterStats } from './index'
// Server-side usage: track events from API routes, middleware, etc.
```

### 3.3 Stripe billing

**Add to Postgres schema:**
```sql
ALTER TABLE organisations ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE organisations ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE organisations ADD COLUMN plan_expires_at TIMESTAMPTZ;

CREATE TABLE plan_limits (
    plan            TEXT PRIMARY KEY,
    max_sites       INT NOT NULL,
    max_queries     INT NOT NULL,  -- AEO queries per day
    max_keywords    INT NOT NULL,  -- Rank tracker keywords
    has_aeo         BOOL NOT NULL DEFAULT false,
    has_links       BOOL NOT NULL DEFAULT false,
    has_sdk         BOOL NOT NULL DEFAULT false,
    has_white_label BOOL NOT NULL DEFAULT false
);

INSERT INTO plan_limits VALUES
    ('internal', 100, 1000, 10000, true, true, true, true),
    ('starter',    3,   50,   500, false, false, false, false),
    ('pro',       10,  500,  5000, true, true, true, false),
    ('agency',   100, 5000, 50000, true, true, true, true);
```

**Stripe webhook handler in axum:**
```rust
// POST /webhooks/stripe
// Verify Stripe-Signature header using stripe-rust crate
// Handle events:
//   checkout.session.completed → set plan, store customer/subscription IDs
//   customer.subscription.updated → update plan
//   customer.subscription.deleted → downgrade to free/internal
```

**Plan gate middleware:**
```rust
pub async fn require_feature(
    feature: &'static str,
    State(state): State<AppState>,
    Extension(ctx): Extension<AuthContext>,
    req: Request,
    next: Next,
) -> Result<impl IntoResponse, StatusCode> {
    let org_id = ctx.require_org_id()?;
    let has_feature = check_plan_feature(org_id, feature, &state.db).await?;
    if !has_feature {
        return Err(StatusCode::PAYMENT_REQUIRED);
    }
    Ok(next.run(req).await)
}
```

### 3.4 White label

- Allow orgs on the agency plan to set a custom domain (e.g. `analytics.theiragency.com`)
- Store `custom_domain` on the `organisations` table
- Cloudflare Workers or CNAME routing to point their domain at the Next.js app
- Logo + brand colour overrides stored per org, applied via CSS variables at runtime

### 3.5 Scheduled reports

**Worker job — weekly report generation:**
- Generate a per-client summary PDF or email using Resend
- Include: traffic trend, top AEO citation changes, top keyword movers, new/lost backlinks
- Configurable per org (day of week, email recipients)

### 3.6 Grafana monitoring

- Deploy Grafana as a Railway service
- Connect to Postgres and ClickHouse as data sources
- Build dashboards for: API latency, worker job success rates, ClickHouse query times, Railway memory/CPU

### 3.7 Self-serve onboarding

Update the Next.js signup flow to allow public registration:
- Remove any internal-only gates
- Add Stripe checkout on plan selection
- Guided onboarding: create site → connect GA4 → connect GSC → install snippet (optional)
- In-app upgrade prompts when feature gates are hit

### Phase 3 done when:
- [ ] Backlinks module live with Ahrefs data
- [ ] `@betterstats/sdk` published to npm
- [ ] Stripe billing end-to-end (subscribe, upgrade, cancel)
- [ ] Plan gates enforced on all gated features
- [ ] White label working for agency plan
- [ ] Weekly email reports sending
- [ ] Grafana dashboards live
- [ ] Public sign-up flow working

---

## General coding conventions

### Rust
- Use `anyhow::Result` in binaries and application code, `thiserror` for library error types
- Every `async fn` that touches the DB takes `&PgPool` or `&ClickHouseClient` as a param — no globals
- All DB queries scoped by `org_id` — if a query doesn't have `WHERE org_id = $1`, it needs a code review
- Use `tracing::instrument` on all public async functions
- Format with `cargo fmt`, lint with `cargo clippy -- -D warnings`

### TypeScript / Next.js
- Use `app` router, `server components` by default, `use client` only when needed
- API calls to Rust backend always go through a `lib/api.ts` helper that attaches the Clerk token
- Use `zod` for runtime validation of API responses
- All components that render data should have a loading skeleton state

### Database
- Never run raw SQL strings with user input — always use sqlx parameterised queries
- All ClickHouse writes are fire-and-forget (spawn a background task, don't await in the request handler)
- Run `sqlx migrate run` on API startup before binding the port

### Security
- Validate `org_id` on every API route — the path param must match the JWT claim
- OAuth tokens stored encrypted at rest using AES-256-GCM
- Rate limit the ingest endpoint: 1000 events/minute per site_id using Redis token bucket
- Never log access tokens, refresh tokens, or API keys

---

## Running locally

```bash
# Start all services
docker compose up -d   # postgres, clickhouse, redis

# Run migrations
cd apps/api && sqlx migrate run

# Start everything with Turbo
pnpm turbo run dev
```

`docker-compose.yml` should include: postgres:16, clickhouse/clickhouse-server:latest, redis:7.

---

## Key decisions log

| Decision | Choice | Reason |
|---|---|---|
| Monorepo manager | Turborepo | JS+Rust co-location, caching |
| Backend language | Rust | Async I/O performance for query runner |
| Auth provider | Clerk | Org model, invite flows, zero auth UI |
| Primary DB | Postgres + TimescaleDB | Relational data + time-series |
| Analytics DB | ClickHouse | Fast aggregation on large event tables |
| Hosting | Railway | Managed, simple, cheap to start |
| AEO data collection | Cloud-only (API queries) | No client code needed, ships fast |
| Competitor reference | Sitechecker | Cloud-only, GSC-derived prompts, no snippet |
| Differentiator | Claude API recommendations | Turns monitoring into action |
