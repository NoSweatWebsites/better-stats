import { OrganizationSwitcher, UserButton } from '@clerk/nextjs'
import Link from 'next/link'

const navItems = [
  { href: 'traffic', label: 'Traffic' },
  { href: 'seo', label: 'SEO' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <aside className="w-56 border-r bg-gray-50 flex flex-col gap-4 p-4">
        <div className="font-semibold text-lg">betterstats</div>
        <OrganizationSwitcher hidePersonal />
        <nav className="flex flex-col gap-1 mt-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded px-3 py-2 text-sm hover:bg-gray-200"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto">
          <UserButton />
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  )
}
