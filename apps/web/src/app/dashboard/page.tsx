'use client'

import { useAuth, OrganizationList } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

export default function DashboardPage() {
  const { orgId, getToken, isLoaded } = useAuth()
  const router = useRouter()
  const [noSites, setNoSites] = useState(false)

  useEffect(() => {
    if (!isLoaded || !orgId) return

    getToken().then(async (token) => {
      if (!token) return
      try {
        const res = await fetch(`${API_URL}/api/orgs/${orgId}/sites`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const sites = await res.json()
        if (Array.isArray(sites) && sites.length > 0) {
          router.push(`/dashboard/${sites[0].id}/traffic`)
        } else {
          setNoSites(true)
        }
      } catch {
        setNoSites(true)
      }
    })
  }, [orgId, isLoaded, getToken, router])

  if (!isLoaded) return null

  if (!orgId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2">Select an organisation</h1>
          <p className="text-sm text-gray-500 mb-6">
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

  if (!noSites) return null

  return <CreateSiteForm orgId={orgId} />
}

function CreateSiteForm({ orgId }: { orgId: string }) {
  const { getToken } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const form = e.currentTarget
    const name = (form.elements.namedItem('name') as HTMLInputElement).value
    const domain = (form.elements.namedItem('domain') as HTMLInputElement).value
    const token = await getToken()
    const res = await fetch(`${API_URL}/api/orgs/${orgId}/sites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, domain }),
    })
    const site = await res.json()
    router.push(`/dashboard/${site.id}/traffic`)
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Welcome to betterstats</h1>
        <p className="text-gray-500 text-sm">Add your first site to start tracking.</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-80">
        <input name="name" placeholder="Site name" required className="border rounded px-3 py-2 text-sm" />
        <input name="domain" placeholder="example.com" required className="border rounded px-3 py-2 text-sm" />
        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white rounded px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create site'}
        </button>
      </form>
    </div>
  )
}
