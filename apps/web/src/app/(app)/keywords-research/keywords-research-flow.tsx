'use client'

import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  ArrowRight,
  Check,
  Download,
  Loader2,
  Search,
  Sparkles,
  Target,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type FormState = {
  niche: string
  targetAudience: string
  businessGoal: string
  targetMarket: string
  siteStage: string
  websiteUrl: string
  brandContext: string
  existingContent: string
  reportAudience: string
  competitors: string[]
}

type SavedReport = {
  id: string
  title: string
  brief: string
  markdown: string
  createdAt: string
}

const INITIAL_FORM: FormState = {
  niche: '',
  targetAudience: '',
  businessGoal: 'Leads',
  targetMarket: 'United Kingdom',
  siteStage: 'New',
  websiteUrl: '',
  brandContext: '',
  existingContent: '',
  reportAudience: 'Internal strategy',
  competitors: ['', '', ''],
}

const STEPS = [
  { id: 1, label: 'Strategy', description: 'Market, audience, and goal' },
  { id: 2, label: 'Signals', description: 'Site context and competitors' },
  { id: 3, label: 'Brief', description: 'Review before generation' },
] as const

const BUSINESS_GOALS = ['Traffic', 'Leads', 'Sales', 'Authority', 'Education']
const SITE_STAGES = ['New', 'Growing', 'Established']
const REPORT_AUDIENCES = ['Internal strategy', 'Client delivery']

const EMPTY_REPORT = `# Keyword Research Strategy

Complete the brief, then generate a strategy. The first version uses Claude with the keyword research and SEO strategy skill instructions. Google Ads keyword metrics, live SERP fetching, ranking-page scraping, and PDF export are marked as integration points for the next build step.
`

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  rows?: number
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-(--muted-2)">
        {label}
      </span>
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-24 w-full resize-y rounded-lg border border-(--border) bg-(--surface) px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-(--muted-2) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--primary)_35%,white)]"
      />
    </label>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-(--muted-2)">
        {label}
      </span>
      {children}
    </label>
  )
}

function PillGroup({
  value,
  options,
  onChange,
}: {
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = value === option
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              active
                ? 'border-(--foreground) bg-(--foreground) text-(--surface)'
                : 'border-(--border) bg-(--surface) text-(--muted) hover:bg-(--surface-2)'
            )}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}

function SignalCard({
  title,
  status,
  description,
}: {
  title: string
  status: 'ready' | 'next'
  description: string
}) {
  return (
    <div className="rounded-xl border border-(--border) bg-(--surface) p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-(--foreground)">{title}</p>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
            status === 'ready'
              ? 'bg-[color-mix(in_srgb,var(--positive)_22%,white)] text-(--foreground)'
              : 'bg-(--surface-2) text-(--muted-2)'
          )}
        >
          {status === 'ready' ? 'Ready' : 'Next'}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-(--muted-2)">{description}</p>
    </div>
  )
}

function ReportPreview({
  markdown,
  onDownload,
  canDownload,
}: {
  markdown: string
  onDownload: () => void
  canDownload: boolean
}) {
  return (
    <div className="h-full overflow-hidden rounded-xl border border-(--border) bg-(--surface)">
      <div className="flex items-center justify-between border-b border-(--border) px-5 py-3">
        <div>
          <p className="text-sm font-semibold text-(--foreground)">Strategy report</p>
          <p className="text-xs text-(--muted-2)">Claude output rendered as client-ready markdown</p>
        </div>
        <Button variant="outline" size="sm" onClick={onDownload} disabled={!canDownload}>
          <Download size={13} />
          Download PDF
        </Button>
      </div>
      <div className="prose prose-sm max-w-none overflow-y-auto p-6 text-(--foreground) prose-headings:text-(--foreground) prose-p:text-(--muted) prose-strong:text-(--foreground) prose-th:text-(--foreground) prose-td:text-(--muted)">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </div>
    </div>
  )
}

export function KeywordsResearchFlow() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [report, setReport] = useState(EMPTY_REPORT)
  const [reports, setReports] = useState<SavedReport[]>([])
  const [activeReportId, setActiveReportId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/keywords-research/reports')
      .then((response) => response.ok ? response.json() : { reports: [] })
      .then((data) => {
        const savedReports = data.reports ?? []
        setReports(savedReports)
        if (savedReports[0]) {
          setActiveReportId(savedReports[0].id)
          setReport(savedReports[0].markdown)
        }
      })
      .catch(() => setReports([]))
  }, [])

  const progress = ((step - 1) / (STEPS.length - 1)) * 100
  const canContinue = useMemo(() => {
    if (step === 1) {
      return Boolean(form.niche.trim() && form.targetAudience.trim() && form.businessGoal.trim())
    }
    if (step === 2) {
      return Boolean(form.targetMarket.trim() && form.siteStage.trim())
    }
    return true
  }, [form, step])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function generateStrategy() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/keywords-research/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!response.ok) {
        throw new Error('Unable to generate strategy')
      }

      const data = await response.json()
      setReport(data.markdown ?? EMPTY_REPORT)
      if (data.report) {
        setReports((current) => [data.report, ...current.filter((item) => item.id !== data.report.id)])
        setActiveReportId(data.report.id)
      }
    } catch {
      setError('The strategy could not be generated. Check your Claude API setup and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
    <div className="keywords-screen flex min-h-full flex-col bg-(--background)">
      <div className="border-b border-(--border) bg-(--surface) px-8 py-5">
        <div className="mb-4 flex items-start justify-between gap-6">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--primary)_10%,white)] px-3 py-1 text-xs font-semibold text-(--foreground)">
              <Search size={12} />
              Keywords Research
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-(--foreground)">Build an organic growth strategy</h1>
            <p className="mt-1 max-w-2xl text-sm text-(--muted-2)">
              Turn a niche, audience, and business goal into prioritized keyword clusters, quick wins, content gaps, and a 30/60/90-day execution plan.
            </p>
          </div>
          <Button onClick={generateStrategy} disabled={loading || !canContinue} className="shrink-0">
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Generating
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Generate strategy
              </>
            )}
          </Button>
        </div>

        <div className="h-1 overflow-hidden rounded-full bg-(--surface-2)">
          <div
            className="h-full rounded-full bg-(--primary) transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="grid flex-1 grid-cols-[minmax(420px,520px)_1fr] gap-6 overflow-hidden p-8">
        <div className="flex min-h-0 flex-col gap-4">
          <div className="rounded-xl border border-(--border) bg-(--surface) p-4">
            <div className="grid grid-cols-3 gap-2">
              {STEPS.map((item) => {
                const active = step === item.id
                const complete = step > item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setStep(item.id)}
                    className={cn(
                      'rounded-lg border px-3 py-3 text-left transition-colors',
                      active
                        ? 'border-(--foreground) bg-(--foreground) text-(--surface)'
                        : 'border-(--border) bg-(--surface) text-(--muted) hover:bg-(--surface-2)'
                    )}
                  >
                    <span className="mb-2 flex h-5 w-5 items-center justify-center rounded-full border border-current text-[11px]">
                      {complete ? <Check size={12} /> : item.id}
                    </span>
                    <span className="block text-xs font-semibold">{item.label}</span>
                    <span className={cn('mt-0.5 block text-[11px]', active ? 'text-(--surface)/70' : 'text-(--muted-2)')}>
                      {item.description}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {reports.length > 0 && (
            <div className="rounded-xl border border-(--border) bg-(--surface) p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-(--foreground)">Saved reports</p>
                  <p className="text-xs text-(--muted-2)">Stored per organisation</p>
                </div>
                <span className="rounded-full bg-(--surface-2) px-2 py-0.5 text-xs font-medium text-(--muted-2)">
                  {reports.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {reports.slice(0, 5).map((savedReport) => {
                  const active = activeReportId === savedReport.id
                  return (
                    <button
                      key={savedReport.id}
                      type="button"
                      onClick={() => {
                        setActiveReportId(savedReport.id)
                        setReport(savedReport.markdown)
                      }}
                      className={cn(
                        'w-full rounded-lg px-3 py-2 text-left transition-colors',
                        active
                          ? 'bg-[color-mix(in_srgb,var(--primary)_10%,white)] text-(--foreground)'
                          : 'text-(--muted) hover:bg-(--surface-2)'
                      )}
                    >
                      <span className="block truncate text-sm font-medium">{savedReport.title}</span>
                      <span className="mt-0.5 block text-xs text-(--muted-2)">
                        {new Date(savedReport.createdAt).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-(--border) bg-(--surface) p-6">
            {step === 1 && (
              <div className="space-y-5 bs-enter">
                <div>
                  <h2 className="text-lg font-semibold text-(--foreground)">Strategy context</h2>
                  <p className="mt-1 text-sm text-(--muted-2)">Start with the market decision before collecting keyword data.</p>
                </div>

                <Field label="Niche / industry">
                  <Input
                    value={form.niche}
                    onChange={(event) => update('niche', event.target.value)}
                    placeholder="Example: accounting software for UK freelancers"
                  />
                </Field>

                <Field label="Target audience">
                  <Input
                    value={form.targetAudience}
                    onChange={(event) => update('targetAudience', event.target.value)}
                    placeholder="Example: solo consultants and micro agencies"
                  />
                </Field>

                <div>
                  <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-(--muted-2)">
                    Business goal
                  </span>
                  <PillGroup
                    value={form.businessGoal}
                    options={BUSINESS_GOALS}
                    onChange={(value) => update('businessGoal', value)}
                  />
                </div>

                <TextArea
                  label="Brand / offer context"
                  value={form.brandContext}
                  onChange={(value) => update('brandContext', value)}
                  placeholder="What do you sell, what makes it different, and which offers matter most?"
                />
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5 bs-enter">
                <div>
                  <h2 className="text-lg font-semibold text-(--foreground)">Research signals</h2>
                  <p className="mt-1 text-sm text-(--muted-2)">These fields shape country-specific demand, intent, and ranking realism.</p>
                </div>

                <Field label="Target country / market">
                  <Input
                    value={form.targetMarket}
                    onChange={(event) => update('targetMarket', event.target.value)}
                    placeholder="United Kingdom"
                  />
                </Field>

                <div>
                  <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-(--muted-2)">
                    Site maturity
                  </span>
                  <PillGroup
                    value={form.siteStage}
                    options={SITE_STAGES}
                    onChange={(value) => update('siteStage', value)}
                  />
                </div>

                <Field label="Website URL (optional)">
                  <Input
                    value={form.websiteUrl}
                    onChange={(event) => update('websiteUrl', event.target.value)}
                    placeholder="https://example.com"
                  />
                </Field>

                <TextArea
                  label="Existing content (optional)"
                  value={form.existingContent}
                  onChange={(value) => update('existingContent', value)}
                  placeholder="Paste existing pillar pages, blog categories, or topics already covered."
                />

                <div>
                  <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-(--muted-2)">
                    Competitors (optional)
                  </span>
                  <div className="space-y-2">
                    {form.competitors.map((competitor, index) => (
                      <Input
                        key={index}
                        value={competitor}
                        onChange={(event) => {
                          const competitors = [...form.competitors]
                          competitors[index] = event.target.value
                          update('competitors', competitors)
                        }}
                        placeholder={`Competitor ${index + 1}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5 bs-enter">
                <div>
                  <h2 className="text-lg font-semibold text-(--foreground)">Strategy brief</h2>
                  <p className="mt-1 text-sm text-(--muted-2)">Confirm the report mode and generation inputs.</p>
                </div>

                <div>
                  <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-(--muted-2)">
                    Report audience
                  </span>
                  <PillGroup
                    value={form.reportAudience}
                    options={REPORT_AUDIENCES}
                    onChange={(value) => update('reportAudience', value)}
                  />
                </div>

                <div className="rounded-xl border border-(--border) bg-(--surface-2) p-4">
                  <dl className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="text-xs text-(--muted-2)">Niche</dt>
                      <dd className="mt-1 font-medium text-(--foreground)">{form.niche || 'Missing'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-(--muted-2)">Audience</dt>
                      <dd className="mt-1 font-medium text-(--foreground)">{form.targetAudience || 'Missing'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-(--muted-2)">Goal</dt>
                      <dd className="mt-1 font-medium text-(--foreground)">{form.businessGoal}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-(--muted-2)">Market</dt>
                      <dd className="mt-1 font-medium text-(--foreground)">{form.targetMarket}</dd>
                    </div>
                  </dl>
                </div>

                <div className="grid gap-3">
                  <SignalCard
                    title="Claude strategy engine"
                    status="ready"
                    description="Uses the project keyword research and SEO strategy skill instructions to produce the first strategy report."
                  />
                  <SignalCard
                    title="Google Ads keyword data"
                    status="next"
                    description="Needs your Google Ads account and target API setup before live volume, competition, and CPC can be pulled."
                  />
                  <SignalCard
                    title="SERP and ranking-page analysis"
                    status="next"
                    description="Needs a SERP provider or scraping decision before we can inspect top results and competitor gaps automatically."
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-[color-mix(in_srgb,var(--danger)_28%,white)] bg-[color-mix(in_srgb,var(--danger)_8%,white)] px-4 py-3 text-sm text-(--foreground)">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setStep((current) => Math.max(current - 1, 1))}
              disabled={step === 1}
            >
              Back
            </Button>
            {step < STEPS.length ? (
              <Button
                onClick={() => setStep((current) => Math.min(current + 1, STEPS.length))}
                disabled={!canContinue}
              >
                Continue
                <ArrowRight size={14} />
              </Button>
            ) : (
              <Button onClick={generateStrategy} disabled={loading || !canContinue}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Target size={14} />}
                Generate report
              </Button>
            )}
          </div>
        </div>

        <div className="min-h-0">
          <div className="mb-4 grid grid-cols-3 gap-3">
            <SignalCard
              title="Primary opportunity"
              status="ready"
              description="Finds one anchor keyword and rejects distracting topic branches."
            />
            <SignalCard
              title="6 Circles clusters"
              status="ready"
              description="Builds one pillar, three subtopics, and nine supporting content pieces."
            />
            <SignalCard
              title="Execution roadmap"
              status="ready"
              description="Turns keyword decisions into a 14-day sprint and 30/60/90-day plan."
            />
          </div>
          <div className="h-[calc(100%-88px)]">
            <ReportPreview
              markdown={report}
              canDownload={report !== EMPTY_REPORT}
              onDownload={() => window.print()}
            />
          </div>
        </div>
      </div>

    </div>
    <div className="keywords-print">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
    </div>
    </>
  )
}
