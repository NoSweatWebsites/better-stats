'use client'

import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { X, Loader2, CheckCircle2, ExternalLink } from 'lucide-react'
import { ModelIcon } from './model-icon'
import { format } from 'date-fns'

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

export function ScanDrawer({ scanId, onClose }: { scanId: string | null; onClose: () => void }) {
  const [scan, setScan] = useState<ScanDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [showSources, setShowSources] = useState(false)

  useEffect(() => {
    if (!scanId) { setScan(null); setShowSources(false); return }
    setLoading(true)
    setScan(null)
    fetch(`/api/scans/${scanId}`)
      .then((r) => r.json())
      .then((data) => { setScan(data); setLoading(false) })
  }, [scanId])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!scanId) return null

  const yourMentions = scan?.mentions.filter((m) => m.isOwnBrand).reduce((acc, m) => acc + m.count, 0) ?? 0
  const competitorMentions = scan?.mentions.filter((m) => !m.isOwnBrand).reduce((acc, m) => acc + m.count, 0) ?? 0
  const hasMentions = yourMentions + competitorMentions > 0

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[600px] max-w-full bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">AI Response Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="animate-spin text-gray-300" size={20} />
          </div>
        ) : scan ? (
          <div className="flex-1 overflow-y-auto">
            {/* Prompt meta bar */}
            <div className="px-6 pt-5 pb-4 border-b border-gray-50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Prompt</span>
                  <ModelIcon model={scan.model} size={18} />
                </div>
                {scan.citations.length > 0 && (
                  <button
                    onClick={() => setShowSources((v) => !v)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    <ExternalLink size={11} />
                    {showSources ? 'Hide Sources' : 'View Source List'}
                  </button>
                )}
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-1">{scan.promptText}</p>
              <p className="text-xs text-gray-400">
                *Data for the last check on{' '}
                {scan.ranAt ? format(new Date(scan.ranAt), 'MMM d, yyyy') : '—'}
              </p>

              {/* Source list */}
              {showSources && scan.citations.length > 0 && (
                <div className="mt-3 space-y-1">
                  {scan.citations.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                      {c.url ? (
                        <a href={c.url} target="_blank" rel="noopener noreferrer"
                          className="hover:text-indigo-600 truncate hover:underline">{c.url}</a>
                      ) : (
                        <span className="text-gray-400">{c.domain}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Mention stats */}
            {hasMentions && (
              <div className="mx-6 mt-4 mb-2 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3 flex items-center gap-6">
                <span className="text-sm text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  Your mentions: <strong>{yourMentions}</strong>
                </span>
                <span className="text-sm text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  Competitors&apos; mentions: <strong>{competitorMentions}</strong>
                </span>
              </div>
            )}

            {/* Markdown response */}
            <div className="px-6 py-5 prose prose-sm max-w-none
              prose-headings:text-gray-900 prose-a:text-indigo-600 prose-hr:border-gray-100
              prose-strong:text-gray-900 prose-code:text-gray-700 prose-code:bg-gray-100">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {scan.rawResponse ?? '*No response recorded*'}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center flex-1 text-sm text-gray-400">
            Response not found
          </div>
        )}
      </div>
    </>
  )
}
