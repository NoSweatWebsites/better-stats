import { auth } from '@clerk/nextjs/server'
import { makeApi } from '@/lib/api'

interface Props {
  params: { siteId: string }
  searchParams: { days?: string }
}

export default async function SeoPage({ params, searchParams }: Props) {
  const { getToken, orgId } = await auth()
  if (!orgId) return <p>No organisation selected.</p>

  const token = await getToken()
  if (!token) return null

  const days = Number(searchParams.days ?? 30)
  const api = makeApi(token)
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
                No data yet. Connect Google Search Console to start syncing.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
