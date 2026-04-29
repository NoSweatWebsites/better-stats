import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getDb, scans, scanBatches, prompts, mentions, citations, brands } from '@betterstats/db'
import { eq, and } from 'drizzle-orm'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { orgId } = await auth()
  if (!orgId) return new NextResponse('Unauthorized', { status: 401 })

  const { id } = await params
  const db = getDb()

  const [scan] = await db
    .select({
      id: scans.id,
      model: scans.model,
      status: scans.status,
      rawResponse: scans.rawResponse,
      wordCount: scans.wordCount,
      ranAt: scans.ranAt,
      promptText: prompts.text,
    })
    .from(scans)
    .innerJoin(prompts, eq(scans.promptId, prompts.id))
    .innerJoin(scanBatches, eq(scans.batchId, scanBatches.id))
    .where(and(eq(scans.id, id), eq(scanBatches.organisationId, orgId)))

  if (!scan) return new NextResponse('Not found', { status: 404 })

  const scanMentions = await db
    .select({ count: mentions.count, brandName: brands.name, isOwnBrand: brands.isOwnBrand })
    .from(mentions)
    .innerJoin(brands, eq(mentions.brandId, brands.id))
    .where(eq(mentions.scanId, id))

  const scanCitations = await db.select().from(citations).where(eq(citations.scanId, id))

  return NextResponse.json({ ...scan, mentions: scanMentions, citations: scanCitations })
}
