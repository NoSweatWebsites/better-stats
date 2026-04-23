CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
