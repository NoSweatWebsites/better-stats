# betterstats.io — Claude Code build instructions

## What you are building

An internal AI visibility tool called **betterstats.io**. It tracks how brands and competitors appear in AI-generated responses across Claude, ChatGPT, Gemini, and Perplexity. Multi-tenant via Clerk organisations — each client sees only their own data, the admin sees all.

---

## Repository structure

Create two services in a monorepo:

```
betterstats/
├── apps/
│   ├── web/          # Next.js 15 app (frontend + API routes)
│   └── scanner/      # Hono scan runner service
├── packages/
│   └── db/           # Drizzle schema + migrations (shared)
├── package.json      # Workspace root
└── turbo.json        # Turborepo config
```

---

## Tech stack

- **Next.js 15** (App Router) + **TypeScript** — `apps/web`
- **Hono** + **TypeScript** — `apps/scanner`
- **PostgreSQL** on Railway — single database, shared between both services
- **Drizzle ORM** — `packages/db`, used in both services
- **Clerk** — auth + multi-tenancy via organisations
- **Tailwind CSS** + **shadcn/ui** — UI
- **Anthropic SDK** (`@anthropic-ai/sdk`)
- **OpenAI SDK** (`openai`)
- **Google AI SDK** (`@google/generative-ai`)
- **Perplexity** — REST API (OpenAI-compatible endpoint)

---

## Environment variables

### apps/web (.env.local)
```
DATABASE_URL=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
SCANNER_URL=                        # internal Railway URL of the scanner service
SCANNER_SECRET=                     # shared secret to authenticate web → scanner calls
```

### apps/scanner (.env)
```
DATABASE_URL=
SCANNER_SECRET=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_AI_API_KEY=
PERPLEXITY_API_KEY=
```

---

## Database schema (packages/db)

Use Drizzle ORM with PostgreSQL. Define all tables in `packages/db/schema.ts`.

```typescript
import { pgTable, uuid, text, boolean, integer, timestamp } from 'drizzle-orm/pg-core'

export const organisations = pgTable('organisations', {
  id: text('id').primaryKey(),           // Clerk organisation ID
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const prompts = pgTable('prompts', {
  id: uuid('id').primaryKey().defaultRandom(),
  organisationId: text('organisation_id').notNull().references(() => organisations.id),
  text: text('text').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const brands = pgTable('brands', {
  id: uuid('id').primaryKey().defaultRandom(),
  organisationId: text('organisation_id').notNull().references(() => organisations.id),
  name: text('name').notNull(),
  isOwnBrand: boolean('is_own_brand').default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const scanBatches = pgTable('scan_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  organisationId: text('organisation_id').notNull().references(() => organisations.id),
  status: text('status').notNull().default('pending'), // pending | running | complete | failed
  triggeredAt: timestamp('triggered_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
})

export const scans = pgTable('scans', {
  id: uuid('id').primaryKey().defaultRandom(),
  batchId: uuid('batch_id').references(() => scanBatches.id),
  promptId: uuid('prompt_id').notNull().references(() => prompts.id),
  model: text('model').notNull(),        // claude | chatgpt | gemini | perplexity
  status: text('status').notNull().default('pending'), // pending | complete | failed
  rawResponse: text('raw_response'),
  wordCount: integer('word_count'),
  ranAt: timestamp('ran_at'),
})

export const mentions = pgTable('mentions', {
  id: uuid('id').primaryKey().defaultRandom(),
  scanId: uuid('scan_id').notNull().references(() => scans.id),
  brandId: uuid('brand_id').notNull().references(() => brands.id),
  count: integer('count').notNull().default(0),
})

export const citations = pgTable('citations', {
  id: uuid('id').primaryKey().defaultRandom(),
  scanId: uuid('scan_id').notNull().references(() => scans.id),
  domain: text('domain').notNull(),
  url: text('url'),                      // populated for Perplexity only
  isActual: boolean('is_actual').default(false), // true = Perplexity API, false = inferred
})
```

Run migrations with `drizzle-kit push` against the Railway Postgres instance.

---

## Clerk setup

Use **Clerk organisations** for multi-tenancy.

- Every user belongs to one or more organisations
- Each organisation maps to one client project
- The admin user is a member of all organisations
- All database queries filter by `organisationId` from the active Clerk session

In `apps/web/middleware.ts`:
```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher(['/login(.*)'])

export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) auth().protect()
})

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
}
```

In every API route, get the organisation ID like this:
```typescript
import { auth } from '@clerk/nextjs/server'

const { orgId } = auth()
if (!orgId) return new Response('Unauthorized', { status: 401 })
```

Filter every database query by `organisationId: orgId`.

---

## Onboarding flow (apps/web)

If a user is authenticated but their organisation has no prompts or brands set up yet, redirect them to `/onboarding` instead of `/dashboard`.

Build a full-screen split-layout onboarding with 4 steps. Left side = form step. Right side = static product preview (screenshot or illustration of the dashboard).

Show a progress bar across the top.

### Step 1 — Project setup
- Input: project/company name
- Input: primary domain (e.g. mybrand.com)
- Creates or updates the organisation record in Postgres

### Step 2 — Add your brand + competitors
- Input: own brand name (pre-filled from domain if possible)
- Up to 4 competitor brand name inputs
- Saves to `brands` table with `isOwnBrand = true` for the first entry

### Step 3 — Add tracking prompts
- Textarea list — add up to 5 prompts (e.g. "best CRM for small business")
- Provide 3 suggested prompts based on their domain/industry (generate with a quick Claude API call using their company name)
- Saves to `prompts` table

### Step 4 — Choose models + run first scan
- Four toggle cards: Claude, ChatGPT, Gemini, Perplexity (all on by default)
- "Run your first scan" button
- Triggers scan batch, shows a loading state ("Scanning across 4 models…")
- On completion, redirects to `/dashboard`

After onboarding is complete, never show it again for that organisation.

---

## Page structure (apps/web)

```
/login                    Clerk sign-in page
/onboarding               Full-screen onboarding (4 steps)
/dashboard                Main dashboard
/scans                    Scan history list
/scans/[id]               Individual scan detail with raw response + highlights
/settings/prompts         Manage tracked prompts
/settings/brands          Manage tracked brands
/settings/models          Toggle which models to include in scans
```

---

## Dashboard UI

The dashboard is clean and data-forward. Use shadcn/ui components throughout. Reference the Sitechecker/Brammels-style competitor dashboard in the design.

### Layout
- Top: filter bar — model selector (All / Claude / ChatGPT / Gemini / Perplexity), date range picker (7d / 30d / 90d)
- Row 1: four metric cards — Mention Rate, Visibility Score, Total Citations, Prompts Tracked
- Row 2: full-width multi-line area chart — brand visibility over time (one line per brand, including competitors)
- Row 3: two columns
  - Left: Brand Visibility table — brand name, mention rate, visibility score (circular progress), citation count, citation share
  - Right: Top Citation Sources — domain, citation count, impact badge (High / Medium / Low)
- Row 4: Recent Scans — prompt text, model icons, mention count, timestamp, link to detail

### Metric cards
Show label, large number, and delta vs previous period (green up arrow / red down arrow).

### Visibility chart
Multi-line area chart using recharts or Chart.js. One line per tracked brand. Tooltip on hover shows all brands' scores for that date. Toggleable legend below.

### Competitor table
Columns: Brand, AI Models used, Prompt Runs, Mentions, Visibility (circular progress ring), Citations, Citation Share. Sortable. Own brand highlighted with a subtle badge.

---

## API routes (apps/web/app/api)

All routes require a valid Clerk session and filter by `orgId`.

```
GET    /api/prompts              List prompts for org
POST   /api/prompts              Add prompt
DELETE /api/prompts/[id]         Delete prompt

GET    /api/brands               List brands for org
POST   /api/brands               Add brand
DELETE /api/brands/[id]          Delete brand

POST   /api/scans/run            Create scan_batch + POST to scanner service
GET    /api/scans                List recent scans for org
GET    /api/scans/[id]           Single scan with mentions + citations
GET    /api/scans/batch/[id]     Batch status for polling

GET    /api/dashboard            Aggregate stats for org (mention rate, score, trends)
```

Authenticate web → scanner calls using a shared `SCANNER_SECRET` header.

---

## Scanner service (apps/scanner)

A Hono app with a single route:

```
POST /run-batch
Headers: x-scanner-secret: <SCANNER_SECRET>
Body: { batchId: string, orgId: string }
```

### Scan logic

1. Validate `x-scanner-secret` header
2. Fetch all prompts for `orgId` from Postgres
3. Fetch all brands for `orgId` from Postgres
4. Update batch status to `running`
5. Build job list: every prompt × every active model = N jobs
6. Run all jobs in parallel with `Promise.all`
7. For each job:
   a. Call the relevant LLM API with the prompt text
   b. Insert row into `scans` (status: complete, raw_response, word_count)
   c. Run mention detection → insert rows into `mentions`
   d. Run citation detection → insert rows into `citations`
8. Update batch status to `complete` (or `failed` if all jobs failed)

### LLM API calls

**Claude**
```typescript
import Anthropic from '@anthropic-ai/sdk'
const client = new Anthropic()
const response = await client.messages.create({
  model: 'claude-opus-4-6',
  max_tokens: 1024,
  messages: [{ role: 'user', content: prompt }],
})
const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('')
```

**ChatGPT**
```typescript
import OpenAI from 'openai'
const client = new OpenAI()
const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: prompt }],
})
const text = response.choices[0].message.content ?? ''
```

**Gemini**
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'
const client = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' })
const result = await model.generateContent(prompt)
const text = result.response.text()
```

**Perplexity**
```typescript
const response = await fetch('https://api.perplexity.ai/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'sonar',
    messages: [{ role: 'user', content: prompt }],
  }),
})
const data = await response.json()
const text = data.choices[0].message.content ?? ''
const citations: string[] = data.citations ?? [] // actual URLs — store with is_actual = true
```

### Mention detection

```typescript
function detectMentions(text: string, brands: { id: string; name: string }[]) {
  return brands.map(brand => {
    const regex = new RegExp(brand.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    const count = (text.match(regex) ?? []).length
    return { brandId: brand.id, count }
  }).filter(m => m.count > 0)
}
```

### Citation detection (non-Perplexity models)

```typescript
const KNOWN_DOMAINS: Record<string, string> = {
  'g2': 'g2.com',
  'capterra': 'capterra.com',
  'gartner': 'gartner.com',
  'trustpilot': 'trustpilot.com',
  'techcrunch': 'techcrunch.com',
  'forbes': 'forbes.com',
  'pcmag': 'pcmag.com',
  'techradar': 'techradar.com',
  'getapp': 'getapp.com',
  'softwareadvice': 'softwareadvice.com',
  'producthunt': 'producthunt.com',
  'reddit': 'reddit.com',
  'trustradius': 'trustradius.com',
  'business news daily': 'businessnewsdaily.com',
  'nerdwallet': 'nerdwallet.com',
  'investopedia': 'investopedia.com',
  'entrepreneur': 'entrepreneur.com',
  'zdnet': 'zdnet.com',
  'cnet': 'cnet.com',
}

function inferCitations(text: string): string[] {
  const lower = text.toLowerCase()
  return Object.entries(KNOWN_DOMAINS)
    .filter(([keyword]) => lower.includes(keyword))
    .map(([, domain]) => domain)
}
```

### Visibility score formula

```typescript
// Per brand, per time window
const visibilityScore = Math.round((scansWithMention / totalScans) * 100)
```

---

## Railway deployment

Deploy as two separate Railway services from the same monorepo:

- **web** service: `cd apps/web && npm run build && npm start`
- **scanner** service: `cd apps/scanner && npm run build && npm start`
- **Postgres** service: Railway native database, share `DATABASE_URL` with both services

Both services reference the same `DATABASE_URL` environment variable.

---

## Implementation order

Build in this order:

1. Monorepo scaffold (Turborepo, workspaces)
2. `packages/db` — Drizzle schema + migrations
3. `apps/web` — Next.js app with Clerk auth + middleware
4. Onboarding flow (4 steps)
5. Dashboard UI (static/mock data first, wire up real data after)
6. API routes in `apps/web`
7. `apps/scanner` — Hono service with all four LLM integrations
8. Connect scan trigger (web → scanner → Postgres → dashboard)
9. Settings pages (prompts, brands, models)
10. Scan detail page

---

## Notes

- Every database query must filter by `organisationId` — never return cross-org data
- The scanner service must validate `x-scanner-secret` on every request
- Perplexity citations (`is_actual = true`) should be visually distinct in the UI from inferred citations
- The dashboard should feel fast — compute visibility scores and aggregates in SQL, not in application code
- Use `Promise.all` for parallel LLM calls in the scanner — never run them sequentially
- Keep the UI clean and minimal — reference the Sitechecker/Brammels aesthetic in the screenshots provided

---

*Last updated: April 2026*