'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings, ChevronRight, BarChart2, Globe, MessageSquareText, LayoutDashboard, ScanSearch } from 'lucide-react'
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const aiVisibilityItems = [
  { href: '/dashboard', label: 'AI Chats Visibility', icon: MessageSquareText },
  { href: '/google-aio', label: 'Google AI Overview', icon: Globe },
  { href: '/ai-traffic', label: 'AI Traffic (GA4)', icon: BarChart2 },
]

const settingsItems = [
  { href: '/settings/prompts', label: 'Prompts' },
  { href: '/settings/brands', label: 'Brands' },
  { href: '/settings/models', label: 'Models' },
]

export function Nav() {
  const pathname = usePathname()

  const aiVisibilityActive = aiVisibilityItems.some((item) =>
    pathname === item.href || pathname.startsWith(item.href + '/')
  )
  const [aiOpen, setAiOpen] = useState(true)

  return (
    <aside className="w-56 shrink-0 flex flex-col h-screen border-r border-(--border) bg-(--surface) px-3 py-4">
      <div className="px-2 mb-6">
        <span className="text-lg font-semibold tracking-tight text-(--foreground)">betterstats</span>
        <span className="ml-1 text-xs font-medium text-(--primary)">.io</span>
      </div>

      <div className="px-2 mb-4">
        <OrganizationSwitcher hidePersonal appearance={{ elements: { rootBox: 'w-full' } }} />
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto">

        {/* AI Visibility section */}
        <button
          onClick={() => setAiOpen((v) => !v)}
          className={cn(
            'w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors',
            aiVisibilityActive
              ? 'text-(--foreground) font-medium'
              : 'text-(--muted-2) hover:text-(--foreground) hover:bg-(--surface-2)'
          )}
        >
          <LayoutDashboard size={15} className="shrink-0" />
          <span className="flex-1 text-left">AI Visibility</span>
          <ChevronRight
            size={13}
            className={cn('shrink-0 transition-transform text-(--muted-2)', aiOpen && 'rotate-90')}
          />
        </button>

        {aiOpen && (
          <div className="pl-4 space-y-0.5">
            {aiVisibilityItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors',
                    active
                      ? 'bg-(--surface-2) text-(--foreground) font-medium'
                      : 'text-(--muted-2) hover:text-(--foreground) hover:bg-(--surface-2)'
                  )}
                >
                  <Icon size={14} className="shrink-0" />
                  {label}
                </Link>
              )
            })}
          </div>
        )}

        {/* Scans */}
        <Link
          href="/scans"
          className={cn(
            'flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors',
            pathname.startsWith('/scans')
              ? 'bg-(--surface-2) text-(--foreground) font-medium'
              : 'text-(--muted-2) hover:text-(--foreground) hover:bg-(--surface-2)'
          )}
        >
          <ScanSearch size={15} className="shrink-0" />
          Scans
        </Link>

        {/* Settings */}
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
              'flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors',
              pathname === href
                ? 'bg-(--surface-2) text-(--foreground) font-medium'
                : 'text-(--muted-2) hover:text-(--foreground) hover:bg-(--surface-2)'
            )}
          >
            <ChevronRight size={13} className="text-[color-mix(in_srgb,var(--primary)_35%,white)] shrink-0" />
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
