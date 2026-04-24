import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { OrganizationList } from '@clerk/nextjs'
import { makeApi } from '@/lib/api'

export default async function DashboardPage() {
  const { getToken, orgId } = await auth()

  if (!orgId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2">Select an organisation</h1>
          <p className="text-gray-500 text-sm mb-6">
            Create or switch to an organisation to continue.
          </p>
        </div>
        <OrganizationList
          hidePersonal
          afterSelectOrganizationUrl="/dashboard"
          afterCreateOrganizationUrl="/dashboard"
        />
      </div>
    )
  }

  const token = await getToken()
  if (!token) redirect('/sign-in')

  const api = makeApi(token)
  const sites: { id: string; name: string; domain: string }[] = await api.sites
    .list(orgId)
    .catch(() => [])

  if (sites.length > 0) {
    redirect(`/dashboard/${sites[0].id}/traffic`)
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Welcome to betterstats</h1>
        <p className="text-gray-500 text-sm">Add your first site to start tracking traffic and SEO.</p>
      </div>
      <CreateSiteForm orgId={orgId} token={token} />
    </div>
  )
}

function CreateSiteForm({ orgId, token }: { orgId: string; token: string }) {
  async function createSite(data: FormData) {
    'use server'
    const name = data.get('name') as string
    const domain = data.get('domain') as string
    const api = makeApi(token)
    const site = await api.sites.create(orgId, { name, domain })
    redirect(`/dashboard/${site.id}/traffic`)
  }

  return (
    <form action={createSite} className="flex flex-col gap-3 w-80">
      <input
        name="name"
        placeholder="Site name"
        required
        className="border rounded px-3 py-2 text-sm"
      />
      <input
        name="domain"
        placeholder="example.com"
        required
        className="border rounded px-3 py-2 text-sm"
      />
      <button
        type="submit"
        className="bg-black text-white rounded px-4 py-2 text-sm font-medium hover:bg-gray-800"
      >
        Create site
      </button>
    </form>
  )
}
