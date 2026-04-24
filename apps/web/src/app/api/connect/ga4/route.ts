import { auth } from '@clerk/nextjs/server'
import { NextRequest } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

function orgIdFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    // Clerk v4: top-level org_id; Clerk v5: o.id
    return payload.org_id ?? payload.o?.id ?? null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const { getToken } = await auth()
  const token = await getToken()
  if (!token) return new Response('Unauthorized', { status: 401 })

  const orgId = orgIdFromToken(token)
  if (!orgId) return new Response('Forbidden — no active organisation', { status: 403 })

  const siteId = req.nextUrl.searchParams.get('siteId')
  if (!siteId) return new Response('Missing siteId', { status: 400 })

  const res = await fetch(
    `${API_URL}/api/orgs/${orgId}/integrations/ga4/url?site_id=${siteId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )

  if (!res.ok) return new Response('Failed to begin OAuth', { status: 502 })

  const { url } = await res.json()
  return Response.redirect(url, 302)
}
