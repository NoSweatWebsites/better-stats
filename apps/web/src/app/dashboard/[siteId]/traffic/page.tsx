import { auth } from '@clerk/nextjs/server'
import { makeApi } from '@/lib/api'

interface Props {
  params: { siteId: string }
  searchParams: { days?: string }
}

export default async function TrafficPage({ params, searchParams }: Props) {
  const { getToken, orgId } = await auth()
  if (!orgId) return <p>No organisation selected.</p>

  const token = await getToken()
  if (!token) return null

  const days = Number(searchParams.days ?? 30)
  const api = makeApi(token)
  const rows = await api.dashboard.traffic(orgId, days).catch(() => [])

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Traffic</h1>
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
                No data yet. Connect GA4 to start syncing.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
