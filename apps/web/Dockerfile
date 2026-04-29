FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# ── Install dependencies ──────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/db/package.json packages/db/
COPY apps/web/package.json apps/web/
COPY apps/scanner/package.json apps/scanner/
RUN pnpm install --no-frozen-lockfile

# ── Build ─────────────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app
COPY packages/ packages/
COPY apps/web/ apps/web/
RUN pnpm --filter @betterstats/web build

# ── Runtime ───────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/web/server.js"]
