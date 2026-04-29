import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getDb, prompts, organisations } from '@betterstats/db'
import { eq } from 'drizzle-orm'

export async function GET() {
  const { orgId } = await auth()
  if (!orgId) return new NextResponse('Unauthorized', { status: 401 })

  const db = getDb()
  const rows = await db.select().from(prompts).where(eq(prompts.organisationId, orgId))
  return NextResponse.json(rows, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: Request) {
  const { orgId, orgSlug } = await auth()
  if (!orgId) return new NextResponse('Unauthorized', { status: 401 })

  const { text, orgName } = await req.json()
  if (!text?.trim()) return new NextResponse('text required', { status: 400 })

  const db = getDb()

  // Upsert org row
  await db.insert(organisations).values({ id: orgId, name: orgName ?? orgSlug ?? orgId }).onConflictDoNothing()

  const [row] = await db.insert(prompts).values({ organisationId: orgId, text: text.trim() }).returning()
  return NextResponse.json(row, { status: 201 })
}
