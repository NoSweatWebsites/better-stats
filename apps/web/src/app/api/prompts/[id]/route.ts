import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getDb, prompts } from '@betterstats/db'
import { and, eq } from 'drizzle-orm'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { orgId } = await auth()
  if (!orgId) return new NextResponse('Unauthorized', { status: 401 })

  const { id } = await params
  const db = getDb()
  await db.delete(prompts).where(and(eq(prompts.id, id), eq(prompts.organisationId, orgId)))
  return new NextResponse(null, { status: 204 })
}
