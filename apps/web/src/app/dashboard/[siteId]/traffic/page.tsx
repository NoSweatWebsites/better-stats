import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { auth } from '@clerk/nextjs/server'
import { makeApi } from '@/lib/api'

interface Props {
  params: { siteId: string }
  searchParams: { days?: string }
}

export default async function TrafficPage({ params, searchParams }: Props) {
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

  const ga4Connected: boolean = integrations?.ga4?.connected ?? false
  const hasPropertyId: boolean = !!site.ga4_property_id

  async function savePropertyId(formData: FormData) {
    'use server'
    const { getToken: gt, orgId: oid } = await auth()
    const tok = await gt()
    if (!tok || !oid) return
    const propertyId = (formData.get('ga4_property_id') as string).trim()
    await makeApi(tok).sites.update(oid, siteId, { ga4_property_id: propertyId })
    revalidatePath(`/dashboard/${siteId}/traffic`)
  }

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
          <form action={savePropertyId} className="flex gap-2 mt-4">
            <input
              name="ga4_property_id"
              placeholder="123456789"
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
  const rows = await api.dashboard.traffic(orgId, days).catch(() => [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Traffic</h1>
        <select
          defaultValue={days}
          className="border rounded px-3 py-1.5 text-sm"
          disabled
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
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
