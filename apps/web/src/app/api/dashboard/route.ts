import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getDb, scans, scanBatches, mentions, brands, citations, prompts } from '@betterstats/db'
import { eq, gte, and, inArray } from 'drizzle-orm'
import { subDays, format, eachDayOfInterval } from 'date-fns'

export async function GET(req: Request) {
  const { orgId } = await auth()
  if (!orgId) return new NextResponse('Unauthorized', { status: 401 })

  const { searchParams } = new URL(req.url)
  const days = parseInt(searchParams.get('days') ?? '30')
  const since = subDays(new Date(), days)

  const db = getDb()

  const orgBrands = await db.select().from(brands).where(eq(brands.organisationId, orgId))
  const orgPrompts = await db.select().from(prompts).where(eq(prompts.organisationId, orgId))

  const orgScans = await db
    .select({ id: scans.id, model: scans.model, ranAt: scans.ranAt, promptId: scans.promptId })
    .from(scans)
    .innerJoin(scanBatches, eq(scans.batchId, scanBatches.id))
    .where(and(eq(scanBatches.organisationId, orgId), gte(scans.ranAt, since), eq(scans.status, 'complete')))

  const totalScans = orgScans.length
  const scanIds = orgScans.map((s) => s.id)

  const ownBrand = orgBrands.find((b) => b.isOwnBrand)

  // All mentions in window
  const allMentions = scanIds.length > 0
    ? await db.select().from(mentions).where(inArray(mentions.scanId, scanIds))
    : ([] as { id: string; scanId: string; brandId: string; count: number }[])

  // All citations in window
  const allCitations = scanIds.length > 0
    ? await db.select().from(citations).where(inArray(citations.scanId, scanIds))
    : ([] as { id: string; scanId: string; domain: string; url: string | null; isActual: boolean | null }[])

  // Brand stats
  const brandStats = orgBrands.map((brand) => {
    const brandMentions = allMentions.filter((m) => m.brandId === brand.id)
    const scansWithMention = new Set(brandMentions.filter((m) => m.count > 0).map((m) => m.scanId)).size
    const mentionCount = brandMentions.reduce((acc, m) => acc + m.count, 0)
    const visibilityScore = totalScans > 0 ? Math.round((scansWithMention / totalScans) * 100) : 0
    const brandCitationCount = allCitations.filter((c) => brandMentions.some((m) => m.scanId === c.scanId)).length
    const citShare = allCitations.length > 0 ? Math.round((brandCitationCount / allCitations.length) * 100) : 0
    const models = [...new Set(orgScans.filter((s) => brandMentions.some((m) => m.scanId === s.id)).map((s) => s.model))]
    const promptRuns = new Set(orgScans.map((s) => s.id)).size
    return { ...brand, mentionCount, visibilityScore, scansWithMention, citationCount: brandCitationCount, citShare, models, promptRuns }
  })

  // Per-prompt stats (one row per prompt × model)
  const promptStats = orgPrompts.flatMap((prompt) => {
    const promptScans = orgScans.filter((s) => s.promptId === prompt.id)
    const models = [...new Set(promptScans.map((s) => s.model))]

    return models.map((model) => {
      const modelScans = promptScans.filter((s) => s.model === model)
      const modelScanIds = modelScans.map((s) => s.id)
      const promptRuns = modelScans.length

      const ownMentions = ownBrand
        ? allMentions.filter((m) => m.brandId === ownBrand.id && modelScanIds.includes(m.scanId))
        : []
      const yourMentions = ownMentions.reduce((acc, m) => acc + m.count, 0)
      const scansWithMention = new Set(ownMentions.filter((m) => m.count > 0).map((m) => m.scanId)).size
      const yourVisibility = promptRuns > 0 ? Math.round((scansWithMention / promptRuns) * 100) : 0

      const promptCitations = allCitations.filter((c) => modelScanIds.includes(c.scanId))
      const allCitationsCount = promptCitations.length
      const yourCitationsCount = ownBrand
        ? promptCitations.filter((c) =>
            ownMentions.some((m) => m.scanId === c.scanId)
          ).length
        : 0
      const citShare = allCitationsCount > 0 ? Math.round((yourCitationsCount / allCitationsCount) * 100) : 0

      // Find the latest scan id for this prompt+model for the "AI Response" link
      const latestScan = modelScans.sort((a, b) =>
        (b.ranAt?.getTime() ?? 0) - (a.ranAt?.getTime() ?? 0)
      )[0]

      return {
        promptId: prompt.id,
        promptText: prompt.text,
        model,
        promptRuns,
        yourMentions,
        yourVisibility,
        allCitations: allCitationsCount,
        yourCitations: yourCitationsCount,
        citShare,
        latestScanId: latestScan?.id ?? null,
      }
    })
  })

  // Time series: daily visibility per brand
  const dateRange = eachDayOfInterval({ start: since, end: new Date() })
  const timeSeries = dateRange.map((date) => {
    const dayStr = format(date, 'MMM d')
    const dayScans = orgScans.filter((s) => s.ranAt && format(s.ranAt, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'))
    const dayScanIds = dayScans.map((s) => s.id)
    const entry: Record<string, string | number | null> = { date: dayStr }
    for (const brand of orgBrands) {
      if (dayScanIds.length === 0) { entry[brand.id] = null; continue }
      const dayMentions = allMentions.filter((m) => dayScanIds.includes(m.scanId) && m.brandId === brand.id)
      const scansWithMention = new Set(dayMentions.filter((m) => m.count > 0).map((m) => m.scanId)).size
      entry[brand.id] = Math.round((scansWithMention / dayScanIds.length) * 100)
    }
    return entry
  })

  // Top citation domains
  const domainCounts: Record<string, number> = {}
  const domainModels: Record<string, Set<string>> = {}
  const scanModelMap = new Map(orgScans.map((s) => [s.id, s.model]))
  for (const { domain, scanId } of allCitations) {
    domainCounts[domain] = (domainCounts[domain] ?? 0) + 1
    const model = scanModelMap.get(scanId)
    if (model) {
      if (!domainModels[domain]) domainModels[domain] = new Set()
      domainModels[domain].add(model)
    }
  }
  const totalCitCount = allCitations.length
  const topCitations = Object.entries(domainCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([domain, count]) => ({
      domain,
      count,
      citShare: totalCitCount > 0 ? Math.round((count / totalCitCount) * 1000) / 10 : 0,
      models: [...(domainModels[domain] ?? new Set())],
    }))

  const mentionRate = totalScans > 0 && ownBrand
    ? Math.round((brandStats.find((b) => b.isOwnBrand)?.scansWithMention ?? 0) / totalScans * 100)
    : 0

  return NextResponse.json({
    totalScans,
    promptsTracked: orgPrompts.length,
    mentionRate,
    visibilityScore: brandStats.find((b) => b.isOwnBrand)?.visibilityScore ?? 0,
    totalCitations: allCitations.length,
    brands: brandStats,
    topCitations,
    promptStats,
    timeSeries,
  })
}
