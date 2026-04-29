'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Scan, Settings, ChevronRight } from 'lucide-react'
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/scans', label: 'Scans', icon: Scan },
]

const settingsItems = [
  { href: '/settings/prompts', label: 'Prompts' },
  { href: '/settings/brands', label: 'Brands' },
  { href: '/settings/models', label: 'Models' },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <aside className="w-56 shrink-0 flex flex-col h-screen border-r border-(--border) bg-(--surface) px-3 py-4">
      <div className="px-2 mb-6">
        <span className="text-lg font-semibold tracking-tight text-(--foreground)">betterstats</span>
        <span className="ml-1 text-xs font-medium text-(--primary)">.io</span>
      </div>

      <div className="px-2 mb-4">
        <OrganizationSwitcher hidePersonal appearance={{ elements: { rootBox: 'w-full' } }} />
      </div>

      <nav className="flex-1 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'bs-press bs-hover-lift flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors',
              pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
                ? 'bg-(--surface-2) text-(--foreground) font-medium'
                : 'text-(--muted-2) hover:text-(--foreground) hover:bg-(--surface-2)'
            )}
          >
            <Icon size={15} />
            {label}
          </Link>
        ))}

        <div className="pt-4 pb-1 px-2">
          <span className="text-[10px] font-medium text-(--muted-2) uppercase tracking-wider flex items-center gap-1">
            <Settings size={10} /> Settings
          </span>
        </div>

        {settingsItems.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'bs-press bs-hover-lift flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors',
              pathname === href
                ? 'bg-(--surface-2) text-(--foreground) font-medium'
                : 'text-(--muted-2) hover:text-(--foreground) hover:bg-(--surface-2)'
            )}
          >
            <ChevronRight size={13} className="text-[color-mix(in_srgb,var(--primary)_35%,white)]" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="px-2 pt-4 border-t border-(--border)">
        <UserButton afterSignOutUrl="/login" />
      </div>
    </aside>
  )
}
