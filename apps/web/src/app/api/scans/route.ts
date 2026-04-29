import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getDb, scans, scanBatches, prompts, mentions, brands } from '@betterstats/db'
import { eq, desc } from 'drizzle-orm'

export async function GET() {
  const { orgId } = await auth()
  if (!orgId) return new NextResponse('Unauthorized', { status: 401 })

  const db = getDb()

  const rows = await db
    .select({
      id: scans.id,
      model: scans.model,
      status: scans.status,
      ranAt: scans.ranAt,
      wordCount: scans.wordCount,
      promptText: prompts.text,
      batchId: scans.batchId,
    })
    .from(scans)
    .innerJoin(prompts, eq(scans.promptId, prompts.id))
    .innerJoin(scanBatches, eq(scans.batchId, scanBatches.id))
    .where(eq(scanBatches.organisationId, orgId))
    .orderBy(desc(scans.ranAt))
    .limit(50)

  return NextResponse.json(rows)
}
