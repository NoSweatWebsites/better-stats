import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getDb, scanBatches } from '@betterstats/db'
import { and, eq } from 'drizzle-orm'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { orgId } = await auth()
  if (!orgId) return new NextResponse('Unauthorized', { status: 401 })

  const { id } = await params
  const db = getDb()

  const [batch] = await db
    .select()
    .from(scanBatches)
    .where(and(eq(scanBatches.id, id), eq(scanBatches.organisationId, orgId)))

  if (!batch) return new NextResponse('Not found', { status: 404 })
  return NextResponse.json(batch)
}
