import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getDb, brands, organisations } from '@betterstats/db'
import { eq } from 'drizzle-orm'

export async function GET() {
  const { orgId } = await auth()
  if (!orgId) return new NextResponse('Unauthorized', { status: 401 })

  const db = getDb()
  const rows = await db.select().from(brands).where(eq(brands.organisationId, orgId))
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const { orgId, orgSlug } = await auth()
  if (!orgId) return new NextResponse('Unauthorized', { status: 401 })

  const { name, isOwnBrand, orgName } = await req.json()
  if (!name?.trim()) return new NextResponse('name required', { status: 400 })

  const db = getDb()
  await db.insert(organisations).values({ id: orgId, name: orgName ?? orgSlug ?? orgId }).onConflictDoNothing()

  const [row] = await db.insert(brands).values({ organisationId: orgId, name: name.trim(), isOwnBrand: isOwnBrand ?? false }).returning()
  return NextResponse.json(row, { status: 201 })
}
