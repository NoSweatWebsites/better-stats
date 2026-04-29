FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# ── Install dependencies ──────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json packages/db/
COPY apps/scanner/package.json apps/scanner/
RUN mkdir -p apps/web && echo '{"name":"@betterstats/web","version":"0.0.1","private":true}' > apps/web/package.json
RUN pnpm install --no-frozen-lockfile --prod

# ── Build ─────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json packages/db/
COPY apps/scanner/package.json apps/scanner/
RUN mkdir -p apps/web && echo '{"name":"@betterstats/web","version":"0.0.1","private":true}' > apps/web/package.json
RUN pnpm install --no-frozen-lockfile
COPY packages/ packages/
COPY apps/scanner/ apps/scanner/
RUN pnpm --filter @betterstats/scanner build

# ── Runtime ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/scanner/dist/index.js ./index.js
EXPOSE 3001
ENV PORT=3001
CMD ["node", "index.js"]
