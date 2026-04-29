import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getDb, scanBatches, organisations } from '@betterstats/db'

export async function POST(req: Request) {
  const { orgId, orgSlug } = await auth()
  if (!orgId) return new NextResponse('Unauthorized', { status: 401 })

  const { orgName } = await req.json().catch(() => ({}))

  const db = getDb()
  await db.insert(organisations).values({ id: orgId, name: orgName ?? orgSlug ?? orgId }).onConflictDoNothing()

  const [batch] = await db.insert(scanBatches).values({ organisationId: orgId }).returning()

  const scannerUrl = process.env.SCANNER_URL
  const scannerSecret = process.env.SCANNER_SECRET

  if (!scannerUrl || !scannerSecret) {
    return NextResponse.json({ error: 'Scanner not configured' }, { status: 503 })
  }

  // Fire-and-forget — scanner updates batch status itself
  fetch(`${scannerUrl}/run-batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-scanner-secret': scannerSecret,
    },
    body: JSON.stringify({ batchId: batch.id, orgId }),
  }).catch(console.error)

  return NextResponse.json({ batchId: batch.id }, { status: 202 })
}
