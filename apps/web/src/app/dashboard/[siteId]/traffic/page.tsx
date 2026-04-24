'use client'

import { useAuth } from '@clerk/nextjs'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { makeApi } from '@/lib/api'

interface Site {
  id: string
  org_id: string
  name: string
  domain: string
  ga4_property_id: string | null
}

interface Integrations {
  ga4: { connected: boolean }
  gsc: { connected: boolean }
}

export default function TrafficPage() {
  const { orgId, getToken } = useAuth()
  const params = useParams()
  const siteId = params.siteId as string

  const [site, setSite] = useState<Site | null>(null)
  const [integrations, setIntegrations] = useState<Integrations | null>(null)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [propertyId, setPropertyId] = useState('')

  useEffect(() => {
    if (!orgId) return
    let cancelled = false

    async function load() {
      const token = await getToken()
      if (!token || cancelled) return
      const api = makeApi(token)
      try {
        const [s, i] = await Promise.all([
          api.sites.get(orgId!, siteId),
          api.integrations.get(orgId!, siteId).catch(() => ({ ga4: { connected: false }, gsc: { connected: false } })),
        ])
        if (cancelled) return
        setSite(s)
        setIntegrations(i)
        if (s.ga4_property_id && i.ga4?.connected) {
          const data = await api.dashboard.traffic(orgId!, 30).catch(() => [])
          if (!cancelled) setRows(data)
        }
      } catch {
        // site not found or error
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [orgId, siteId, getToken])

  async function savePropertyId(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    try {
      const token = await getToken()
      if (!token || !orgId) return
      const id = propertyId.trim()
      await makeApi(token).sites.update(orgId, siteId, { ga4_property_id: id })
      setSite(s => s ? { ...s, ga4_property_id: id } : s)
    } finally {
      setSaving(false)
    }
  }

  if (!orgId || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
      </div>
    )
  }

  if (!site) return <p className="text-gray-500">Site not found.</p>

  const ga4Connected = integrations?.ga4?.connected ?? false
  const hasPropertyId = !!site.ga4_property_id

  if (!ga4Connected) {
    return (
      <div>
        <h1 className="text-2xl font-semibold mb-6">Traffic</h1>
        <div className="border rounded-lg p-6 max-w-md">
          <h2 className="font-semibold mb-1">Connect Google Analytics 4</h2>
          <p className="text-sm text-gray-500 mb-4">
            Authorize betterstats to read your GA4 data.
          </p>
          <a
            href={`/api/connect/ga4?siteId=${siteId}`}
            className="inline-block bg-black text-white rounded px-4 py-2 text-sm font-medium hover:bg-gray-800"
          >
            Authorize with Google
          </a>
        </div>
      </div>
    )
  }

  if (!hasPropertyId) {
    return (
      <div>
        <h1 className="text-2xl font-semibold mb-6">Traffic</h1>
        <div className="border rounded-lg p-6 max-w-md">
          <h2 className="font-semibold mb-1">Enter your GA4 Property ID</h2>
          <p className="text-sm text-gray-500 mb-1">
            Find this in GA4 → Admin → Property Settings. Enter numbers only, e.g.{' '}
            <span className="font-mono">123456789</span>.
          </p>
          <form onSubmit={savePropertyId} className="flex gap-2 mt-4">
            <input
              value={propertyId}
              onChange={e => setPropertyId(e.target.value)}
              placeholder="123456789"
              required
              className="border rounded px-3 py-2 text-sm flex-1"
            />
            <button
              type="submit"
              disabled={saving}
              className="bg-black text-white rounded px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Traffic</h1>
      </div>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="pb-2">Date</th>
            <th className="pb-2">Channel</th>
            <th className="pb-2">Sessions</th>
            <th className="pb-2">Users</th>
            <th className="pb-2">Pageviews</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row: any, i: number) => (
            <tr key={i} className="border-b">
              <td className="py-2">{row.date}</td>
              <td className="py-2 capitalize">{row.channel}</td>
              <td className="py-2">{row.sessions.toLocaleString()}</td>
              <td className="py-2">{row.users.toLocaleString()}</td>
              <td className="py-2">{row.pageviews.toLocaleString()}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="py-8 text-center text-gray-400">
                No data yet — the nightly sync runs at 02:00 UTC.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
