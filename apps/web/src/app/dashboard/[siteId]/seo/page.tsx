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
  gsc_site_url: string | null
}

interface Integrations {
  ga4: { connected: boolean }
  gsc: { connected: boolean }
}

export default function SeoPage() {
  const { orgId, getToken } = useAuth()
  const params = useParams()
  const siteId = params.siteId as string

  const [site, setSite] = useState<Site | null>(null)
  const [integrations, setIntegrations] = useState<Integrations | null>(null)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [siteUrl, setSiteUrl] = useState('')

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
        if (s.gsc_site_url && i.gsc?.connected) {
          const data = await api.dashboard.seo(orgId!, 30).catch(() => [])
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

  async function scanNow() {
    setScanning(true)
    try {
      const token = await getToken()
      if (!token || !orgId) return
      await makeApi(token).sync(orgId, siteId)
      const data = await makeApi(token).dashboard.seo(orgId, 30).catch(() => [])
      setRows(data)
    } finally {
      setScanning(false)
    }
  }

  async function saveSiteUrl(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    try {
      const token = await getToken()
      if (!token || !orgId) return
      const url = siteUrl.trim()
      await makeApi(token).sites.update(orgId, siteId, { gsc_site_url: url })
      setSite(s => s ? { ...s, gsc_site_url: url } : s)
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

  const gscConnected = integrations?.gsc?.connected ?? false
  const hasSiteUrl = !!site.gsc_site_url

  if (!gscConnected) {
    return (
      <div>
        <h1 className="text-2xl font-semibold mb-6">SEO Keywords</h1>
        <div className="border rounded-lg p-6 max-w-md">
          <h2 className="font-semibold mb-1">Connect Google Search Console</h2>
          <p className="text-sm text-gray-500 mb-4">
            Authorize betterstats to read your GSC keyword data.
          </p>
          <a
            href={`/api/connect/gsc?siteId=${siteId}`}
            className="inline-block bg-black text-white rounded px-4 py-2 text-sm font-medium hover:bg-gray-800"
          >
            Authorize with Google
          </a>
        </div>
      </div>
    )
  }

  if (!hasSiteUrl) {
    return (
      <div>
        <h1 className="text-2xl font-semibold mb-6">SEO Keywords</h1>
        <div className="border rounded-lg p-6 max-w-md">
          <h2 className="font-semibold mb-1">Enter your GSC Site URL</h2>
          <p className="text-sm text-gray-500 mb-1">
            Find this in Search Console → Property selector. Use the exact format shown, e.g.{' '}
            <span className="font-mono">https://example.com/</span> or{' '}
            <span className="font-mono">sc-domain:example.com</span>.
          </p>
          <form onSubmit={saveSiteUrl} className="flex gap-2 mt-4">
            <input
              value={siteUrl}
              onChange={e => setSiteUrl(e.target.value)}
              placeholder="https://example.com/"
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
        <h1 className="text-2xl font-semibold">SEO Keywords</h1>
        {rows.length === 0 && (
          <button
            onClick={scanNow}
            disabled={scanning}
            className="bg-black text-white rounded px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {scanning ? 'Scanning…' : 'Scan now'}
          </button>
        )}
      </div>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="pb-2">Keyword</th>
            <th className="pb-2">Clicks</th>
            <th className="pb-2">Impressions</th>
            <th className="pb-2">Position</th>
            <th className="pb-2">CTR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row: any, i: number) => (
            <tr key={i} className="border-b">
              <td className="py-2">{row.keyword}</td>
              <td className="py-2">{row.clicks.toLocaleString()}</td>
              <td className="py-2">{row.impressions.toLocaleString()}</td>
              <td className="py-2">{Number(row.position).toFixed(1)}</td>
              <td className="py-2">{(row.ctr * 100).toFixed(2)}%</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="py-8 text-center text-gray-400">
                {scanning ? 'Fetching your data…' : 'No data yet — click "Scan now" or wait for the nightly sync at 02:00 UTC.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
