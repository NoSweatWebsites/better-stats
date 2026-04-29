'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type ScanDetail = {
  id: string
  model: string
  status: string
  rawResponse: string | null
  wordCount: number | null
  ranAt: string | null
  promptText: string
  mentions: { count: number; brandName: string; isOwnBrand: boolean | null }[]
  citations: { id: string; domain: string; url: string | null; isActual: boolean | null }[]
}

const MODEL_BADGES: Record<string, string> = {
  claude: 'bg-orange-50 text-orange-600',
  chatgpt: 'bg-green-50 text-green-600',
  gemini: 'bg-blue-50 text-blue-600',
  perplexity: 'bg-purple-50 text-purple-600',
  google_aio: 'bg-red-50 text-red-600',
}

export default function ScanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [scan, setScan] = useState<ScanDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/scans/${id}`)
      .then((r) => r.json())
      .then((data) => { setScan(data); setLoading(false) })
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-gray-300" size={20} />
      </div>
    )
  }

  if (!scan) return <div className="p-8 text-gray-400">Scan not found.</div>

  function highlightBrands(text: string, brands: ScanDetail['mentions']) {
    let result = text
    for (const { brandName, isOwnBrand } of brands) {
      const escaped = brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      result = result.replace(
        new RegExp(`\\b(${escaped})\\b`, 'gi'),
        `<mark class="${isOwnBrand ? 'bg-indigo-100 text-indigo-800' : 'bg-orange-100 text-orange-800'} px-0.5 rounded">$1</mark>`
      )
    }
    return result
  }

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <Link href="/scans" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors">
        <ArrowLeft size={14} /> Back to scans
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 mb-1">{scan.promptText}</h1>
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-medium px-2 py-1 rounded-full capitalize', MODEL_BADGES[scan.model] ?? 'bg-gray-50 text-gray-500')}>
              {scan.model}
            </span>
            <span className="text-xs text-gray-400">
              {scan.ranAt ? new Date(scan.ranAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
            </span>
            <span className="text-xs text-gray-400">{scan.wordCount ?? 0} words</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {scan.mentions.map((m) => (
          <div key={m.brandName} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
              {m.brandName}
              {m.isOwnBrand && <span className="bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded-full text-[10px]">You</span>}
            </div>
            <div className="text-2xl font-bold text-gray-900">{m.count}</div>
            <div className="text-xs text-gray-400">mentions</div>
          </div>
        ))}
      </div>

      {scan.citations.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Citations</h2>
          <div className="flex flex-wrap gap-2">
            {scan.citations.map((c) => (
              <span
                key={c.id}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-full font-medium',
                  c.isActual ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-gray-100 text-gray-600'
                )}
                title={c.isActual ? 'Verified citation from Perplexity' : 'Inferred citation'}
              >
                {c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer">{c.domain}</a> : c.domain}
                {c.isActual && ' ✓'}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-400">
            <span className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full mr-1">✓</span> Verified (Perplexity)
            &nbsp;&nbsp;
            <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full mr-1">grey</span> Inferred
          </p>
        </div>
      )}

      {scan.rawResponse && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Raw Response</h2>
          <div
            className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: highlightBrands(scan.rawResponse, scan.mentions) }}
          />
        </div>
      )}
    </div>
  )
}
