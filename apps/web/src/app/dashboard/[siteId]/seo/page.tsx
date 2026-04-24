import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { auth } from '@clerk/nextjs/server'
import { makeApi } from '@/lib/api'

interface Props {
  params: { siteId: string }
  searchParams: { days?: string }
}

export default async function SeoPage({ params, searchParams }: Props) {
  const { siteId } = params
  const { getToken, orgId } = await auth()
  if (!orgId) return <p>No organisation selected.</p>

  const token = await getToken()
  if (!token) redirect('/sign-in')

  const api = makeApi(token)
  const [site, integrations] = await Promise.all([
    api.sites.get(orgId, siteId).catch(() => null),
    api.integrations.get(orgId, siteId).catch(() => ({ ga4: { connected: false }, gsc: { connected: false } })),
  ])

  if (!site) return <p>Site not found.</p>

  const gscConnected: boolean = integrations?.gsc?.connected ?? false
  const hasSiteUrl: boolean = !!site.gsc_site_url

  async function saveSiteUrl(formData: FormData) {
    'use server'
    const { getToken: gt, orgId: oid } = await auth()
    const tok = await gt()
    if (!tok || !oid) return
    const siteUrl = (formData.get('gsc_site_url') as string).trim()
    await makeApi(tok).sites.update(oid, siteId, { gsc_site_url: siteUrl })
    revalidatePath(`/dashboard/${siteId}/seo`)
  }

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
          <form action={saveSiteUrl} className="flex gap-2 mt-4">
            <input
              name="gsc_site_url"
              placeholder="https://example.com/"
              required
              className="border rounded px-3 py-2 text-sm flex-1"
            />
            <button
              type="submit"
              className="bg-black text-white rounded px-4 py-2 text-sm font-medium hover:bg-gray-800"
            >
              Save
            </button>
          </form>
        </div>
      </div>
    )
  }

  const days = Number(searchParams.days ?? 30)
  const rows = await api.dashboard.seo(orgId, days).catch(() => [])

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">SEO Keywords</h1>
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
                No data yet — the nightly sync runs at 02:00 UTC.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
