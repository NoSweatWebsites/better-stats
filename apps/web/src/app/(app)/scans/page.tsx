'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

type Scan = {
  id: string
  model: string
  status: string
  ranAt: string | null
  wordCount: number | null
  promptText: string
  batchId: string | null
}

const MODEL_BADGES: Record<string, string> = {
  claude: 'bg-orange-50 text-orange-600',
  chatgpt: 'bg-green-50 text-green-600',
  gemini: 'bg-blue-50 text-blue-600',
  perplexity: 'bg-purple-50 text-purple-600',
  google_aio: 'bg-red-50 text-red-600',
}

export default function ScansPage() {
  const [scans, setScans] = useState<Scan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/scans')
      .then((r) => r.json())
      .then((data) => { setScans(data); setLoading(false) })
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-(--foreground) mb-6">Scan History</h1>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="animate-spin text-(--border)" size={20} />
        </div>
      ) : scans.length === 0 ? (
        <div className="bs-enter bg-(--surface) rounded-xl border border-(--border) p-16 text-center">
          <p className="text-(--muted-2) text-sm">No scans yet. Run a scan from the dashboard.</p>
        </div>
      ) : (
        <div className="bs-enter bg-(--surface) rounded-xl border border-(--border) overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-(--muted-2) uppercase tracking-wider border-b border-(--border)">
                <th className="text-left px-6 py-3 font-medium">Prompt</th>
                <th className="text-left px-6 py-3 font-medium">Model</th>
                <th className="text-left px-6 py-3 font-medium">Status</th>
                <th className="text-right px-6 py-3 font-medium">Words</th>
                <th className="text-right px-6 py-3 font-medium">Run at</th>
                <th className="px-6 py-3 sr-only">View</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => (
                <tr key={scan.id} className="bs-hover-lift border-b border-[color-mix(in_srgb,var(--border)_65%,white)] last:border-0 hover:bg-(--surface-2)">
                  <td className="px-6 py-3 max-w-xs">
                    <span className="text-(--muted) line-clamp-1">{scan.promptText}</span>
                  </td>
                  <td className="px-6 py-3">
                    <span className={cn('text-xs font-medium px-2 py-1 rounded-full capitalize', MODEL_BADGES[scan.model] ?? 'bg-gray-50 text-gray-500')}>
                      {scan.model}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className={cn(
                      'text-xs font-medium px-2 py-1 rounded-full',
                      scan.status === 'complete' ? 'bg-green-50 text-green-600' :
                      scan.status === 'failed' ? 'bg-red-50 text-red-600' :
                      'bg-yellow-50 text-yellow-600'
                    )}>
                      {scan.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right text-(--muted-2)">{scan.wordCount ?? '—'}</td>
                  <td className="px-6 py-3 text-right text-(--muted-2)">
                    {scan.ranAt ? new Date(scan.ranAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <Link href={`/scans/${scan.id}`} className="text-(--muted-2) hover:text-(--foreground) transition-colors">
                      <ExternalLink size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
