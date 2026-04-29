'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, BarChart2, Globe, MessageSquareText, ScanSearch, Search, Settings2 } from 'lucide-react'
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs'
import { cn } from '@/lib/utils'
import { useState } from 'react'

function AISparkleIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8.13913 4.40682L8.69122 5.86316C8.99416 6.66155 9.47878 7.38663 10.1105 7.98672C10.7423 8.58681 11.5056 9.04713 12.3462 9.33488L13.8794 9.8593C13.9096 9.86984 13.9358 9.88897 13.9542 9.91408C13.9727 9.93919 13.9826 9.96908 13.9826 9.99971C13.9826 10.0303 13.9727 10.0602 13.9542 10.0853C13.9358 10.1105 13.9096 10.1296 13.8794 10.1401L12.3462 10.6645C11.5056 10.9523 10.7423 11.4126 10.1105 12.0127C9.47878 12.6128 8.99416 13.3379 8.69122 14.1363L8.13913 15.5926C8.12803 15.6214 8.1079 15.6462 8.08146 15.6637C8.05502 15.6813 8.02355 15.6907 7.99131 15.6907C7.95906 15.6907 7.92759 15.6813 7.90115 15.6637C7.87472 15.6462 7.85459 15.6214 7.84349 15.5926L7.29139 14.1363C6.98846 13.3379 6.50384 12.6128 5.87208 12.0127C5.24031 11.4126 4.47697 10.9523 3.63645 10.6645L2.10324 10.1401C2.07296 10.1296 2.04683 10.1105 2.02836 10.0853C2.0099 10.0602 2 10.0303 2 9.99971C2 9.96908 2.0099 9.93919 2.02836 9.91408C2.04683 9.88897 2.07296 9.86984 2.10324 9.8593L3.63645 9.33488C4.47697 9.04713 5.24031 8.58681 5.87208 7.98672C6.50384 7.38663 6.98846 6.66155 7.29139 5.86316L7.84349 4.40682C7.85428 4.37777 7.87429 4.35262 7.90077 4.33482C7.92724 4.31703 7.95888 4.30748 7.99131 4.30748C8.02374 4.30748 8.05537 4.31703 8.08185 4.33482C8.10832 4.35262 8.12833 4.37777 8.13913 4.40682ZM15.0406 0.907016L15.3205 1.64433C15.474 2.04856 15.7194 2.41568 16.0393 2.71955C16.3592 3.02341 16.7457 3.25656 17.1713 3.4024L17.9475 3.6682C17.9629 3.67351 17.9762 3.6832 17.9856 3.69593C17.995 3.70867 18 3.72384 18 3.73938C18 3.75493 17.995 3.77009 17.9856 3.78283C17.9762 3.79556 17.9629 3.80525 17.9475 3.81056L17.1713 4.07636C16.7457 4.2222 16.3592 4.45535 16.0393 4.75922C15.7194 5.06308 15.474 5.4302 15.3205 5.83443L15.0406 6.57175C15.035 6.58635 15.0248 6.59897 15.0114 6.60788C14.998 6.6168 14.982 6.62158 14.9657 6.62158C14.9493 6.62158 14.9333 6.6168 14.9199 6.60788C14.9065 6.59897 14.8963 6.58635 14.8907 6.57175L14.6109 5.83443C14.4574 5.4302 14.2119 5.06308 13.892 4.75922C13.5721 4.45535 13.1856 4.2222 12.7601 4.07636L11.9838 3.81056C11.9685 3.80525 11.9552 3.79556 11.9458 3.78283C11.9364 3.77009 11.9314 3.75493 11.9314 3.73938C11.9314 3.72384 11.9364 3.70867 11.9458 3.69593C11.9552 3.6832 11.9685 3.67351 11.9838 3.6682L12.7601 3.4024C13.1856 3.25656 13.5721 3.02341 13.892 2.71955C14.2119 2.41568 14.4574 2.04856 14.6109 1.64433L14.8907 0.907016C14.8963 0.892409 14.9065 0.879791 14.9199 0.870876C14.9333 0.86196 14.9493 0.857178 14.9657 0.857178C14.982 0.857178 14.998 0.86196 15.0114 0.870876C15.0248 0.879791 15.035 0.892409 15.0406 0.907016ZM15.0406 13.4283L15.3205 14.1656C15.474 14.5699 15.7194 14.937 16.0393 15.2409C16.3592 15.5447 16.7457 15.7779 17.1713 15.9237L17.9475 16.1895C17.9629 16.1948 17.9762 16.2045 17.9856 16.2172C17.995 16.23 18 16.2451 18 16.2607C18 16.2762 17.995 16.2914 17.9856 16.3041C17.9762 16.3169 17.9629 16.3266 17.9475 16.3319L17.1713 16.5977C16.7457 16.7435 16.3592 16.9767 16.0393 17.2805C15.7194 17.5844 15.474 17.9515 15.3205 18.3557L15.0406 19.0931C15.035 19.1077 15.0248 19.1203 15.0114 19.1292C14.998 19.1381 14.982 19.1429 14.9657 19.1429C14.9493 19.1429 14.9333 19.1381 14.9199 19.1292C14.9065 19.1203 14.8963 19.1077 14.8907 19.0931L14.6109 18.3557C14.4574 17.9515 14.2119 17.5844 13.892 17.2805C13.5721 16.9767 13.1856 16.7435 12.7601 16.5977L11.9838 16.3319C11.9685 16.3266 11.9552 16.3169 11.9458 16.3041C11.9364 16.2914 11.9314 16.2762 11.9314 16.2607C11.9314 16.2451 11.9364 16.23 11.9458 16.2172C11.9552 16.2045 11.9685 16.1948 11.9838 16.1895L12.7601 15.9237C13.1856 15.7779 13.5721 15.5447 13.892 15.2409C14.2119 14.937 14.4574 14.5699 14.6109 14.1656L14.8907 13.4283C14.9162 13.3617 15.0159 13.3617 15.0406 13.4283Z" fill="currentColor" />
    </svg>
  )
}

const aiVisibilityItems = [
  { href: '/ai-visibility', label: 'AI Chats Visibility', icon: MessageSquareText },
  { href: '/google-aio', label: 'Google AI Overview', icon: Globe },
  { href: '/ai-traffic', label: 'AI Traffic (GA4)', icon: BarChart2 },
]

const growthItems = [
  { href: '/keywords-research', label: 'Keywords Research', icon: Search },
]

const settingsItems = [
  { href: '/scans', label: 'Scans', icon: ScanSearch },
  { href: '/settings/prompts', label: 'Prompts', icon: ChevronRight },
  { href: '/settings/brands', label: 'Brands', icon: ChevronRight },
  { href: '/settings/models', label: 'Models', icon: ChevronRight },
]

function NavSection({
  label,
  icon,
  items,
  pathname,
}: {
  label: string
  icon: React.ReactNode
  items: { href: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[]
  pathname: string
}) {
  const isActive = items.some((i) => pathname === i.href || pathname.startsWith(i.href + '/'))
  const [open, setOpen] = useState(isActive)

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-medium transition-colors',
          isActive
            ? 'bg-[#0B201F] text-[#E6E0C4]'
            : 'text-(--muted-2) hover:text-(--foreground) hover:bg-(--surface-2)'
        )}
      >
        <span className="shrink-0 w-[15px] h-[15px] flex items-center justify-center">{icon}</span>
        <span className="flex-1 text-left">{label}</span>
        <ChevronRight
          size={13}
          className={cn(
            'shrink-0 transition-transform',
            isActive ? 'text-[#E6E0C4]/60' : 'text-(--muted-2)',
            open && 'rotate-90'
          )}
        />
      </button>

      {open && (
        <div className="pl-4 mt-0.5 space-y-0.5">
          {items.map(({ href, label: itemLabel, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link key={href} href={href}
                className={cn(
                  'flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors',
                  active
                    ? 'bg-(--surface-2) text-(--foreground) font-medium'
                    : 'text-(--muted-2) hover:text-(--foreground) hover:bg-(--surface-2)'
                )}
              >
                <Icon size={13} className="shrink-0 text-(--muted-2)" />
                {itemLabel}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

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

      <nav className="flex-1 space-y-1 overflow-y-auto">
        <NavSection
          label="AI Visibility"
          icon={<AISparkleIcon size={15} />}
          items={aiVisibilityItems}
          pathname={pathname}
        />
        <NavSection
          label="Growth Agents"
          icon={<Search size={15} />}
          items={growthItems}
          pathname={pathname}
        />
        <NavSection
          label="Settings"
          icon={<Settings2 size={15} />}
          items={settingsItems}
          pathname={pathname}
        />
      </nav>

      <div className="px-2 pt-4 border-t border-(--border)">
        <UserButton afterSignOutUrl="/login" />
      </div>
    </aside>
  )
}
