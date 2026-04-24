const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

async function apiFetch(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  })
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json()
}

export function makeApi(token: string) {
  return {
    sites: {
      list: (orgId: string) => apiFetch(`/api/orgs/${orgId}/sites`, token),
      get: (orgId: string, siteId: string) =>
        apiFetch(`/api/orgs/${orgId}/sites/${siteId}`, token),
      create: (orgId: string, body: { name: string; domain: string }) =>
        apiFetch(`/api/orgs/${orgId}/sites`, token, {
          method: 'POST',
          body: JSON.stringify(body),
        }),
      update: (
        orgId: string,
        siteId: string,
        body: { name?: string; ga4_property_id?: string; gsc_site_url?: string },
      ) =>
        apiFetch(`/api/orgs/${orgId}/sites/${siteId}`, token, {
          method: 'PUT',
          body: JSON.stringify(body),
        }),
    },
    integrations: {
      get: (orgId: string, siteId: string) =>
        apiFetch(`/api/orgs/${orgId}/sites/${siteId}/integrations`, token),
    },
    sync: (orgId: string, siteId: string) =>
      apiFetch(`/api/orgs/${orgId}/sites/${siteId}/sync`, token, { method: 'POST' }),
    dashboard: {
      traffic: (orgId: string, days = 30) =>
        apiFetch(`/api/orgs/${orgId}/dashboard/traffic?days=${days}`, token),
      seo: (orgId: string, days = 30) =>
        apiFetch(`/api/orgs/${orgId}/dashboard/seo?days=${days}`, token),
    },
  }
}
