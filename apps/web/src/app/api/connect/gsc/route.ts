import { auth } from '@clerk/nextjs/server'
import { NextRequest } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

export async function GET(req: NextRequest) {
  const { getToken, orgId } = await auth()
  if (!orgId) return new Response('Forbidden', { status: 403 })

  const token = await getToken()
  if (!token) return new Response('Unauthorized', { status: 401 })

  const siteId = req.nextUrl.searchParams.get('siteId')
  if (!siteId) return new Response('Missing siteId', { status: 400 })

  const res = await fetch(
    `${API_URL}/api/orgs/${orgId}/integrations/gsc/url?site_id=${siteId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )

  if (!res.ok) return new Response('Failed to begin OAuth', { status: 502 })

  const { url } = await res.json()
  return Response.redirect(url, 302)
}
