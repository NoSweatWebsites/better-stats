import { pgTable, uuid, text, boolean, integer, timestamp } from 'drizzle-orm/pg-core'

export const organisations = pgTable('organisations', {
  id: text('id').primaryKey(), // Clerk organisation ID
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
  model: text('model').notNull(), // claude | chatgpt | gemini | perplexity
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
  url: text('url'),
  isActual: boolean('is_actual').default(false), // true = Perplexity API citation, false = inferred
})

export const keywordResearchReports = pgTable('keyword_research_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  organisationId: text('organisation_id').notNull().references(() => organisations.id),
  title: text('title').notNull(),
  brief: text('brief').notNull(),
  markdown: text('markdown').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
