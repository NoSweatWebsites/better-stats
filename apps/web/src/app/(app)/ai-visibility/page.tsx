'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Loader2, RefreshCw, Plus, Download, ChevronsUpDown, ExternalLink, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CircularProgress } from '@/components/ui/circular-progress'
import { ModelIcon, ModelIconGroup, MODEL_LABELS } from '@/components/model-icon'
import { ScanDrawer } from '@/components/scan-drawer'
import { cn } from '@/lib/utils'

type Brand = {
  id: string; name: string; isOwnBrand: boolean | null
  mentionCount: number; visibilityScore: number; citationCount: number
  citShare: number; models: string[]; promptRuns: number; scansWithMention: number
}

type PromptStat = {
  promptId: string; promptText: string; model: string
  promptRuns: number; yourMentions: number; yourVisibility: number
  allCitations: number; yourCitations: number; citShare: number; latestScanId: string | null
}

type DashboardData = {
  totalScans: number; promptsTracked: number; mentionRate: number
  visibilityScore: number; totalCitations: number
  brands: Brand[]
  topCitations: { domain: string; count: number; citShare: number; models: string[] }[]
  promptStats: PromptStat[]
  timeSeries: Record<string, string | number | null>[]
}

const BRAND_COLORS = [
  'var(--bs-purple)',
  'var(--bs-lime)',
  'var(--bs-red)',
  'color-mix(in srgb, var(--bs-purple) 65%, var(--bs-ink))',
  'color-mix(in srgb, var(--bs-lime) 55%, var(--bs-deep))',
  'color-mix(in srgb, var(--bs-red) 70%, var(--bs-ink))',
]
const TABS = ['Prompts', 'Citations', 'Competitors'] as const
type Tab = typeof TABS[number]

function SortTh({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn('py-3 font-medium select-none', className)}>
      <span className="inline-flex items-center gap-1">
        {children}
        <ChevronsUpDown size={11} className="text-gray-300" />
      </span>
    </th>
  )
}

function SparkCard({ label, value, suffix = '', data, color = 'var(--primary)' }: {
  label: string; value: number; suffix?: string
  data: { value: number }[]; color?: string
}) {
  const gradId = `g-${label.replace(/\s/g, '')}`
  return (
    <div className="bs-hover-lift bs-enter bg-(--surface) rounded-xl border border-(--border) p-5 flex gap-4 items-center flex-1">
      <div className="flex-1">
        <div className="text-xs font-medium text-(--muted-2) mb-1">{label}</div>
        <div className="text-3xl font-bold text-(--foreground)">{value}{suffix}</div>
      </div>
      <div className="w-32 h-14">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradId})`}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0, fill: color }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function BrandSummaryCard({ title, brands }: { title: string; brands: { name: string; value: number; color: string }[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex-1">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-3">
        {title} <Info size={12} className="text-gray-300" />
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
        {brands.slice(0, 8).map((b) => (
          <div key={b.name} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
              <span className="text-xs text-gray-600 truncate">{b.name}</span>
            </div>
            <span className="text-xs font-semibold text-gray-700 shrink-0">{b.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [days, setDays] = useState(30)
  const [tab, setTab] = useState<Tab>('Prompts')
  const [modelFilter, setModelFilter] = useState('all')
  const [scanning, setScanning] = useState(false)
  const [hiddenBrands, setHiddenBrands] = useState<Set<string>>(new Set())
  const [activeScanId, setActiveScanId] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/dashboard?days=${days}`).then((r) => r.json()).then(setData)
  }, [days])

  async function runScan() {
    setScanning(true)
    const res = await fetch('/api/scans/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    const { batchId } = await res.json()
    const deadline = setTimeout(() => { clearInterval(poll); setScanning(false) }, 180_000)
    const poll = setInterval(async () => {
      const r = await fetch(`/api/scans/batch/${batchId}`)
      const batch = await r.json()
      if (batch.status === 'complete' || batch.status === 'failed') {
        clearInterval(poll); clearTimeout(deadline); setScanning(false)
        fetch(`/api/dashboard?days=${days}`).then((r) => r.json()).then(setData)
      }
    }, 3000)
  }

  if (!data) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="animate-spin text-(--border)" size={24} />
    </div>
  )

  const availableModels = [...new Set(data.promptStats.map((p) => p.model))]
  const filteredPrompts = modelFilter === 'all' ? data.promptStats : data.promptStats.filter((p) => p.model === modelFilter)
  const chartData = data.timeSeries.filter((d) => data.brands.some((b) => d[b.id] !== null))
  const ownBrand = data.brands.find((b) => b.isOwnBrand)

  // Sparkline data derived from timeSeries
  const visSparkData = chartData.map((d) => ({ value: ownBrand ? ((d[ownBrand.id] as number | null) ?? 0) : 0 }))
  // Citation share sparkline: use own-brand visibility trend as directional proxy (no per-day citation data from API)
  const ownCitShare = data.totalCitations > 0 ? Math.round((ownBrand?.citationCount ?? 0) / data.totalCitations * 100) : 0
  const citSparkData = visSparkData.length > 0
    ? visSparkData.map((d) => ({ value: d.value > 0 ? Math.round(d.value * ownCitShare / Math.max(data.visibilityScore, 1)) : 0 }))
    : [{ value: 0 }, { value: ownCitShare }]

  const brandSummary = data.brands.map((b, i) => ({ name: b.name, value: b.visibilityScore, color: BRAND_COLORS[i % BRAND_COLORS.length] }))
  const citSummary = data.brands.map((b, i) => ({ name: b.name, value: b.citShare, color: BRAND_COLORS[i % BRAND_COLORS.length] }))

  return (
    <div className="flex flex-col h-full bg-(--background)">
      {/* Page header */}
      <div className="bg-(--surface) border-b border-(--border) px-8 py-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-(--foreground)">AI Chats Visibility</h1>
            <p className="text-xs text-(--muted-2) mt-0.5">Prompt runs: on demand</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={runScan} disabled={scanning}>
              {scanning ? <><Loader2 size={13} className="animate-spin" />Scanning…</> : <><RefreshCw size={13} />Scan now</>}
            </Button>
            <div className="relative group">
              <Button size="sm" className="gap-1">
                <Plus size={13} />Add
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="ml-0.5"><path d="M2.5 3.5L5 6L7.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </Button>
              <div className="absolute right-0 top-full mt-1 w-44 bg-(--surface) border border-(--border) rounded-xl shadow-lg py-1 hidden group-hover:block z-10">
                <Link href="/settings/prompts" className="block px-4 py-2.5 text-sm text-(--foreground) hover:bg-(--surface-2)">Add prompts</Link>
                <Link href="/settings/brands" className="block px-4 py-2.5 text-sm text-(--foreground) hover:bg-(--surface-2)">Add competitors</Link>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5"><Download size={13} />Export</Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="relative flex items-center gap-0 -mb-px">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'bs-press px-5 py-2.5 text-sm font-medium border-b-2 transition-colors',
                tab === t
                  ? 'border-(--primary) text-(--foreground)'
                  : 'border-transparent text-(--muted-2) hover:text-(--foreground)'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-(--surface) border-b border-(--border) px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select value={modelFilter} onChange={(e) => setModelFilter(e.target.value)}
            className="text-sm border border-(--border) rounded-lg px-3 py-1.5 text-(--foreground) bg-(--surface) focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_35%,white)] min-w-[140px]">
            <option value="all">All AI models</option>
            {availableModels.map((m) => <option key={m} value={m}>{MODEL_LABELS[m] ?? m}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-(--border) rounded-lg overflow-hidden text-xs">
            {[{ label: '7D', value: 7 }, { label: '30D', value: 30 }, { label: '90D', value: 90 }].map(({ label, value }) => (
              <button key={value} onClick={() => setDays(value)}
                className={cn(
                  'px-3 py-1.5 transition-colors',
                  days === value
                    ? 'bg-(--foreground) text-(--surface)'
                    : 'bg-(--surface) text-(--muted-2) hover:bg-(--surface-2)'
                )}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── PROMPTS TAB ── */}
        {tab === 'Prompts' && (
          <div>
            {/* Metric spark cards */}
            <div className="px-8 pt-5 pb-4 flex gap-4">
              <SparkCard
                label="Brand Visibility"
                value={data.visibilityScore}
                suffix="%"
                data={visSparkData.length > 1 ? visSparkData : [{ value: 0 }, { value: data.visibilityScore }]}
                color="var(--primary)"
              />
              <SparkCard
                label="Citation Share"
                value={data.totalCitations > 0 ? Math.round((ownBrand?.citationCount ?? 0) / data.totalCitations * 100) : 0}
                suffix="%"
                data={citSparkData.length > 1 ? citSparkData : [{ value: 0 }, { value: data.totalCitations }]}
                color="var(--positive)"
              />
            </div>

            {/* Area chart */}
            <div className="bs-enter mx-8 mb-4 bg-(--surface) rounded-xl border border-(--border) p-5">
              {chartData.length > 1 ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="ownGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.12} />
                          <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted-2)' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--muted-2)' }} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <Tooltip
                        contentStyle={{ border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, boxShadow: '0 4px 12px rgb(0 0 0/0.06)' }}
                        formatter={(v: number) => [`${v}%`, 'Brand Visibility']}
                      />
                      {ownBrand && (
                        <Area type="monotone" dataKey={ownBrand.id} stroke="var(--primary)" strokeWidth={2}
                          fill="url(#ownGrad)" dot={false} activeDot={{ r: 4, fill: 'var(--primary)' }} connectNulls />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <div className="h-36 flex items-center justify-center text-sm text-(--muted-2)">
                  Run more scans over time to see the trend
                </div>
              )}
            </div>

            {/* Prompts table */}
            <div className="bs-enter mx-8 mb-8 bg-(--surface) rounded-xl border border-(--border) overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-(--muted-2) bg-(--surface-2) border-b border-(--border)">
                    <SortTh className="text-left px-5">Prompt</SortTh>
                    <th className="text-center px-4 py-3 text-xs font-medium text-(--muted-2)">AI Model</th>
                    <SortTh className="text-right px-4">Prompt runs</SortTh>
                    <SortTh className="text-right px-4">Your Mentions</SortTh>
                    <SortTh className="text-center px-4">Your Visibility</SortTh>
                    <SortTh className="text-right px-4">All Citations</SortTh>
                    <SortTh className="text-right px-4">Your Citations</SortTh>
                    <SortTh className="text-right px-5">Your Cit. Share</SortTh>
                  </tr>
                </thead>
                <tbody>
                  {filteredPrompts.length === 0 ? (
                    <tr><td colSpan={8} className="px-5 py-12 text-center text-(--muted-2) text-sm">No scan data yet — run a scan to see results</td></tr>
                  ) : filteredPrompts.map((row) => (
                    <tr
                      key={`${row.promptId}-${row.model}`}
                      className="border-t border-[color-mix(in_srgb,var(--border)_65%,white)] hover:bg-[color-mix(in_srgb,var(--primary)_6%,white)] transition-colors"
                    >
                      <td className="px-5 py-3.5 max-w-xs">
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <p className="text-(--muted) text-xs leading-relaxed line-clamp-2">{row.promptText}</p>
                          </div>
                          {row.latestScanId && (
                            <button
                              onClick={() => setActiveScanId(row.latestScanId)}
                              className="inline-flex items-center gap-1.5 text-xs text-(--foreground) font-medium bg-[color-mix(in_srgb,var(--positive)_20%,white)] hover:bg-[color-mix(in_srgb,var(--positive)_30%,white)] px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0">
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1C3.24 1 1 3.24 1 6s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm.5 7.5h-1V5.5h1V8.5zm0-4h-1v-1h1v1z" fill="currentColor"/></svg>
                              AI Response
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <ModelIcon model={row.model} size={20} />
                      </td>
                      <td className="px-4 py-3.5 text-right text-(--muted-2) tabular-nums">{row.promptRuns}</td>
                      <td className="px-4 py-3.5 text-right font-semibold text-(--foreground) tabular-nums">{row.yourMentions}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <CircularProgress value={row.yourVisibility} size={28} strokeWidth={3}
                            color={row.yourVisibility >= 60 ? 'var(--positive)' : row.yourVisibility >= 30 ? 'var(--bs-sand)' : 'var(--border)'} />
                          <span className="text-sm font-semibold text-(--muted) tabular-nums w-9">{row.yourVisibility}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="inline-flex items-center gap-1 bg-[color-mix(in_srgb,var(--primary)_14%,white)] text-(--foreground) font-semibold text-xs px-2.5 py-1 rounded-lg tabular-nums">
                          {row.allCitations}
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M2 1.5L5.5 4 2 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right text-(--muted-2) tabular-nums">{row.yourCitations}</td>
                      <td className="px-5 py-3.5 text-right font-semibold text-(--muted) tabular-nums">{row.citShare}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── CITATIONS TAB ── */}
        {tab === 'Citations' && (
          <div className="m-8 bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 bg-gray-50/60 border-b border-gray-100">
                  <SortTh className="text-left px-5">Domain</SortTh>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-400">AI Model</th>
                  <SortTh className="text-right px-5">Citations</SortTh>
                  <SortTh className="text-right px-5">Cit. Share</SortTh>
                </tr>
              </thead>
              <tbody>
                {data.topCitations.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-12 text-center text-gray-400 text-sm">No citation data yet</td></tr>
                ) : data.topCitations.map(({ domain, count, citShare, models }) => (
                  <tr key={domain} className="border-t border-gray-50 hover:bg-blue-50/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                          alt=""
                          width={18}
                          height={18}
                          className="rounded-sm shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                        <span className="font-medium text-gray-700">{domain}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <ModelIconGroup models={models} />
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 font-semibold text-xs px-2.5 py-1 rounded-lg tabular-nums">
                        {count}
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M2 1.5L5.5 4 2 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm font-medium text-gray-600 tabular-nums">{citShare}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── COMPETITORS TAB ── */}
        {tab === 'Competitors' && (
          <div className="m-8 space-y-4">
            <div className="flex gap-4">
              <BrandSummaryCard title="Brand Visibility" brands={brandSummary} />
              <BrandSummaryCard title="Citation Share" brands={citSummary} />
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              {chartData.length > 1 ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <Tooltip
                        contentStyle={{ border: '1px solid #f3f4f6', borderRadius: 10, fontSize: 12, boxShadow: '0 4px 12px rgb(0 0 0/0.06)', padding: '10px 14px' }}
                        formatter={(v: number, name: string) => {
                          const brand = data.brands.find((b) => b.id === name)
                          return [`${v}%`, brand?.name ?? name]
                        }}
                      />
                      {data.brands.map((brand, i) => !hiddenBrands.has(brand.id) && (
                        <Line key={brand.id} type="monotone" dataKey={brand.id}
                          stroke={BRAND_COLORS[i % BRAND_COLORS.length]}
                          strokeWidth={brand.isOwnBrand ? 2.5 : 1.5}
                          dot={false} activeDot={{ r: 4 }} connectNulls />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 px-1">
                    {data.brands.map((brand, i) => (
                      <button key={brand.id}
                        onClick={() => setHiddenBrands((prev) => { const n = new Set(prev); n.has(brand.id) ? n.delete(brand.id) : n.add(brand.id); return n })}
                        className={cn('flex items-center gap-1.5 text-xs transition-opacity', hiddenBrands.has(brand.id) ? 'opacity-30' : 'opacity-100')}>
                        <span className="w-5 h-0.5 rounded-full inline-block" style={{ backgroundColor: BRAND_COLORS[i % BRAND_COLORS.length] }} />
                        <span className="text-gray-600">{brand.name}{brand.isOwnBrand ? ' (owner)' : ''}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-36 flex items-center justify-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
                  Run more scans over time to see the trend chart
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 bg-gray-50/60 border-b border-gray-100">
                    <SortTh className="text-left px-5">Competitor</SortTh>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-400">AI Models</th>
                    <SortTh className="text-right px-4">Prompt Runs</SortTh>
                    <SortTh className="text-right px-4">Mentions</SortTh>
                    <SortTh className="text-center px-4">Visibility</SortTh>
                    <SortTh className="text-right px-4">Citations</SortTh>
                    <SortTh className="text-right px-5">Cit. Share</SortTh>
                  </tr>
                </thead>
                <tbody>
                  {data.brands.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400 text-sm">No brands tracked yet</td></tr>
                  ) : data.brands.map((brand, i) => (
                    <tr key={brand.id} className="border-t border-gray-50 hover:bg-blue-50/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: BRAND_COLORS[i % BRAND_COLORS.length] }} />
                          <span className="font-medium text-gray-800">{brand.name}</span>
                          {brand.isOwnBrand && <span className="text-[10px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded-full font-medium">owner</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-1">
                          <ModelIconGroup models={brand.models.length > 0 ? brand.models : availableModels} />
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right text-gray-500 tabular-nums">{brand.promptRuns}</td>
                      <td className="px-4 py-3.5 text-right font-semibold text-gray-800 tabular-nums">{brand.mentionCount}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <CircularProgress value={brand.visibilityScore} size={28} strokeWidth={3}
                            color={brand.visibilityScore >= 60 ? '#16a34a' : brand.visibilityScore >= 30 ? '#d97706' : '#d1d5db'} />
                          <span className="text-sm font-semibold text-gray-700 tabular-nums w-9">{brand.visibilityScore}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 font-semibold text-xs px-2.5 py-1 rounded-lg tabular-nums">
                          {brand.citationCount}
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M2 1.5L5.5 4 2 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-gray-700 tabular-nums">{brand.citShare}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <ScanDrawer scanId={activeScanId} onClose={() => setActiveScanId(null)} />
    </div>
  )
}
