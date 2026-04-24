'use client'

import { OrganizationSwitcher, UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

function SidebarNav() {
  const pathname = usePathname()
  // pathname: /dashboard/<siteId>/traffic  →  parts[2] is siteId
  const siteId = pathname.split('/')[2]

  if (!siteId || siteId.length < 36) return null

  const navItems = [
    { href: `/dashboard/${siteId}/traffic`, label: 'Traffic' },
    { href: `/dashboard/${siteId}/seo`, label: 'SEO' },
  ]

  return (
    <nav className="flex flex-col gap-1 mt-4">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`rounded px-3 py-2 text-sm hover:bg-gray-200 ${
            pathname === item.href ? 'bg-gray-200 font-medium' : ''
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <aside className="w-56 border-r bg-gray-50 flex flex-col gap-4 p-4">
        <div className="font-semibold text-lg">betterstats</div>
        <OrganizationSwitcher hidePersonal />
        <SidebarNav />
        <div className="mt-auto">
          <UserButton />
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  )
}
