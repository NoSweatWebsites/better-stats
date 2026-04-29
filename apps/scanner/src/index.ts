import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { getDb, scans, scanBatches, prompts, brands, mentions, citations } from '@betterstats/db'
import { eq } from 'drizzle-orm'
import { callModel } from './llm'
import { detectMentions, inferCitations } from './detect'

const app = new Hono()

const MODEL_ENV_KEYS: Record<string, string> = {
  claude: 'ANTHROPIC_API_KEY',
  chatgpt: 'OPENAI_API_KEY',
  gemini: 'GOOGLE_AI_API_KEY',
  perplexity: 'PERPLEXITY_API_KEY',
  google_aio: 'SERP_API_KEY',
}

const MODELS = ['claude', 'chatgpt', 'gemini', 'perplexity', 'google_aio'].filter(
  (m) => !!process.env[MODEL_ENV_KEYS[m]]
)

app.get('/health', (c) => c.json({ ok: true }))

app.post('/run-batch', async (c) => {
  const secret = c.req.header('x-scanner-secret')
  if (!secret || secret !== process.env.SCANNER_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const { batchId, orgId } = await c.req.json<{ batchId: string; orgId: string }>()
  if (!batchId || !orgId) return c.json({ error: 'batchId and orgId required' }, 400)

  const db = getDb()

  const orgPrompts = await db.select().from(prompts).where(eq(prompts.organisationId, orgId))
  const orgBrands = await db.select().from(brands).where(eq(brands.organisationId, orgId))

  await db.update(scanBatches).set({ status: 'running' }).where(eq(scanBatches.id, batchId))

  // Build job list: every prompt × every model
  type Job = { promptId: string; promptText: string; model: string }
  const jobs: Job[] = orgPrompts.flatMap((p) =>
    MODELS.map((model) => ({ promptId: p.id, promptText: p.text, model }))
  )

  let anySuccess = false

  async function runJob(job: Job) {
    const [scanRow] = await db
      .insert(scans)
      .values({ batchId, promptId: job.promptId, model: job.model, status: 'pending' })
      .returning()

    try {
      const { text, citations: citationUrls } = await callModel(job.model, job.promptText)
      const wordCount = text.split(/\s+/).filter(Boolean).length

      await db
        .update(scans)
        .set({ status: 'complete', rawResponse: text, wordCount, ranAt: new Date() })
        .where(eq(scans.id, scanRow.id))

      const mentionResults = detectMentions(text, orgBrands)
      if (mentionResults.length > 0) {
        await db.insert(mentions).values(
          mentionResults.map((m) => ({ scanId: scanRow.id, brandId: m.brandId, count: m.count }))
        )
      }

      // Perplexity / Google AIO: real URLs with is_actual = true
      const validCitationUrls = citationUrls.filter((url) => { try { new URL(url); return true } catch { return false } })
      if (validCitationUrls.length > 0) {
        await db.insert(citations).values(
          validCitationUrls.map((url) => ({
            scanId: scanRow.id,
            domain: new URL(url).hostname.replace(/^www\./, ''),
            url,
            isActual: true,
          }))
        )
      } else {
        const inferred = inferCitations(text)
        if (inferred.length > 0) {
          await db.insert(citations).values(
            inferred.map((domain) => ({ scanId: scanRow.id, domain, isActual: false }))
          )
        }
      }

      anySuccess = true
    } catch (err: any) {
      const reason = err?.message?.slice(0, 120) ?? String(err)
      console.error(`Scan failed [${job.model}] "${job.promptText.slice(0, 40)}": ${reason}`)
      await db.update(scans).set({ status: 'failed' }).where(eq(scans.id, scanRow.id))
    }
  }

  // Group jobs by model so we can apply per-model concurrency rules
  const jobsByModel = new Map<string, Job[]>()
  for (const job of jobs) {
    const list = jobsByModel.get(job.model) ?? []
    list.push(job)
    jobsByModel.set(job.model, list)
  }

  // Gemini free tier: 15 RPM — run sequentially with a gap to stay safe
  // All other models: run in parallel across prompts
  await Promise.all([...jobsByModel.entries()].map(async ([model, modelJobs]) => {
    if (model === 'gemini') {
      for (let i = 0; i < modelJobs.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 5000))
        await runJob(modelJobs[i])
      }
    } else {
      await Promise.all(modelJobs.map(runJob))
    }
  }))

  const finalStatus = anySuccess ? 'complete' : 'failed'
  await db.update(scanBatches).set({ status: finalStatus, completedAt: new Date() }).where(eq(scanBatches.id, batchId))

  return c.json({ ok: true, status: finalStatus })
})

const port = parseInt(process.env.PORT ?? '3001')
serve({ fetch: app.fetch, port }, () => {
  console.log(`Scanner running on port ${port}`)
})
