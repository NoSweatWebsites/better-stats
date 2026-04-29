import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getDb, keywordResearchReports } from '@betterstats/db'
import { desc, eq } from 'drizzle-orm'

export async function GET() {
  const { orgId } = await auth()
  if (!orgId) return new NextResponse('Unauthorized', { status: 401 })

  const db = getDb()
  const reports = await db
    .select()
    .from(keywordResearchReports)
    .where(eq(keywordResearchReports.organisationId, orgId))
    .orderBy(desc(keywordResearchReports.createdAt))
    .limit(25)

  return NextResponse.json({ reports })
}
