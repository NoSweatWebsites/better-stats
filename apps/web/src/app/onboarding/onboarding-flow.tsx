'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOrganization, useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, Loader2, Plus, X, BarChart3, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

const MODELS = [
  { id: 'claude', label: 'Claude', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { id: 'chatgpt', label: 'ChatGPT', color: 'bg-green-100 text-green-700 border-green-200' },
  { id: 'gemini', label: 'Gemini', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'perplexity', label: 'Perplexity', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { id: 'google_aio', label: 'Google AIO', color: 'bg-red-100 text-red-700 border-red-200' },
]

export function OnboardingFlow() {
  const router = useRouter()
  const { organization } = useOrganization()
  const { user } = useUser()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)

  // Step 1
  const [projectName, setProjectName] = useState(organization?.name ?? '')
  const [domain, setDomain] = useState('')

  // Step 2
  const [ownBrand, setOwnBrand] = useState('')
  const [competitors, setCompetitors] = useState(['', '', '', ''])

  // Step 3
  const [promptInputs, setPromptInputs] = useState(['', '', '', '', ''])
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)

  // Step 4
  const [selectedModels, setSelectedModels] = useState<string[]>(['claude', 'chatgpt', 'gemini', 'google_aio'])
  const [batchId, setBatchId] = useState<string | null>(null)

  async function handleStep1() {
    if (!projectName.trim() || !domain.trim()) return
    setLoadingSuggestions(true)
    try {
      const res = await fetch('/api/onboarding/suggest-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: projectName, domain }),
      })
      const data = await res.json()
      setSuggestedPrompts(data.prompts ?? [])
    } catch {}
    setLoadingSuggestions(false)
    setOwnBrand(projectName)
    setStep(2)
  }

  async function handleStep2() {
    setStep(3)
  }

  async function handleStep3() {
    setStep(4)
  }

  async function handleRunScan() {
    setLoading(true)

    const orgName = organization?.name ?? projectName

    // Save brands
    await fetch('/api/brands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: ownBrand.trim(), isOwnBrand: true, orgName }),
    })
    for (const c of competitors.filter((c) => c.trim())) {
      await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: c.trim(), isOwnBrand: false, orgName }),
      })
    }

    // Save prompts
    for (const text of promptInputs.filter((p) => p.trim())) {
      await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), orgName }),
      })
    }

    // Trigger scan
    setLoading(false)
    setScanning(true)

    const res = await fetch('/api/scans/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgName }),
    })
    const data = await res.json()
    setBatchId(data.batchId)

    // Poll batch status — give up after 3 minutes and go to dashboard anyway
    const deadline = setTimeout(() => { clearInterval(poll); router.push('/dashboard') }, 180_000)
    const poll = setInterval(async () => {
      try {
        const r = await fetch(`/api/scans/batch/${data.batchId}`)
        const batch = await r.json()
        if (batch.status === 'complete' || batch.status === 'failed') {
          clearInterval(poll)
          clearTimeout(deadline)
          router.push('/dashboard')
        }
      } catch {}
    }, 3000)
  }

  const totalSteps = 4
  const progress = ((step - 1) / totalSteps) * 100

  return (
    <div className="min-h-screen flex flex-col bg-(--surface)">
      {/* Progress bar */}
      <div className="h-1 bg-(--surface-2)">
        <div
          className="h-full bg-(--primary) transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex flex-1">
        {/* Left: form */}
        <div className="flex-1 flex items-center justify-center px-8 py-16">
          <div className="w-full max-w-md">
            <div className="mb-2 text-xs font-medium text-(--muted-2) uppercase tracking-widest">
              Step {step} of {totalSteps}
            </div>

            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">Set up your project</h1>
                  <p className="mt-1 text-sm text-(--muted-2)">Tell us about your brand so we know what to track.</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-(--muted) mb-1">Company / project name</label>
                    <Input
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="Acme Corp"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--muted) mb-1">Primary domain</label>
                    <Input
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      placeholder="acmecorp.com"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleStep1}
                  disabled={!projectName.trim() || !domain.trim() || loadingSuggestions}
                  className="w-full"
                >
                  {loadingSuggestions ? (
                    <><Loader2 size={14} className="animate-spin" /> Generating prompt suggestions…</>
                  ) : 'Continue'}
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">Add brands to track</h1>
                  <p className="mt-1 text-sm text-(--muted-2)">Your brand and up to 4 competitors.</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-(--muted-2) mb-1 uppercase tracking-wider">Your brand</label>
                    <Input
                      value={ownBrand}
                      onChange={(e) => setOwnBrand(e.target.value)}
                      placeholder="Acme Corp"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-(--muted-2) mb-1 uppercase tracking-wider">Competitors (optional)</label>
                    <div className="space-y-2">
                      {competitors.map((c, i) => (
                        <Input
                          key={i}
                          value={c}
                          onChange={(e) => {
                            const next = [...competitors]
                            next[i] = e.target.value
                            setCompetitors(next)
                          }}
                          placeholder={`Competitor ${i + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <Button onClick={handleStep2} disabled={!ownBrand.trim()} className="w-full">Continue</Button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">Add tracking prompts</h1>
                  <p className="mt-1 text-sm text-(--muted-2)">
                    These are the questions AI assistants will be asked to check if your brand appears.
                  </p>
                </div>

                {suggestedPrompts.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-(--muted-2) mb-2 uppercase tracking-wider">Suggested</p>
                    <div className="space-y-2">
                      {suggestedPrompts.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            const empty = promptInputs.findIndex((p) => !p.trim())
                            if (empty >= 0) {
                              const next = [...promptInputs]
                              next[empty] = s
                              setPromptInputs(next)
                            }
                          }}
                          className="w-full text-left text-sm px-3 py-2 rounded-lg border border-[color-mix(in_srgb,var(--primary)_20%,white)] bg-[color-mix(in_srgb,var(--primary)_10%,white)] text-(--foreground) hover:bg-[color-mix(in_srgb,var(--primary)_14%,white)] transition-colors flex items-center gap-2"
                        >
                          <Plus size={12} /> {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {promptInputs.map((p, i) => (
                    <div key={i} className="relative">
                      <Input
                        value={p}
                        onChange={(e) => {
                          const next = [...promptInputs]
                          next[i] = e.target.value
                          setPromptInputs(next)
                        }}
                        placeholder={`Prompt ${i + 1}`}
                      />
                      {p && (
                        <button
                          onClick={() => {
                            const next = [...promptInputs]
                            next[i] = ''
                            setPromptInputs(next)
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  onClick={handleStep3}
                  disabled={promptInputs.filter((p) => p.trim()).length === 0}
                  className="w-full"
                >
                  Continue
                </Button>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">Choose models &amp; run scan</h1>
                  <p className="mt-1 text-sm text-(--muted-2)">Select which AI assistants to track your brand across.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {MODELS.map((model) => {
                    const active = selectedModels.includes(model.id)
                    return (
                      <button
                        key={model.id}
                        onClick={() =>
                          setSelectedModels((prev) =>
                            active ? prev.filter((m) => m !== model.id) : [...prev, model.id]
                          )
                        }
                        className={cn(
                          'flex items-center justify-between px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all',
                          active ? `${model.color} border-current` : 'border-gray-200 text-gray-400 bg-white'
                        )}
                      >
                        {model.label}
                        {active && <Check size={14} />}
                      </button>
                    )
                  })}
                </div>

                {scanning ? (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <Loader2 size={24} className="animate-spin text-(--primary)" />
                    <p className="text-sm text-(--muted-2)">Scanning across {selectedModels.length} models…</p>
                    <p className="text-xs text-(--muted-2)">This usually takes 30–60 seconds</p>
                  </div>
                ) : (
                  <Button
                    onClick={handleRunScan}
                    disabled={selectedModels.length === 0 || loading}
                    className="w-full"
                  >
                    {loading ? (
                      <><Loader2 size={14} className="animate-spin" /> Setting up…</>
                    ) : (
                      <><Zap size={14} /> Run your first scan</>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: preview */}
        <div className="hidden lg:flex flex-1 bg-gray-50 border-l border-gray-100 items-center justify-center p-16">
          <div className="w-full max-w-sm space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <BarChart3 size={16} className="text-indigo-600" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">Visibility Score</div>
                  <div className="text-xs text-gray-400">vs last 30 days</div>
                </div>
              </div>
              <div className="text-4xl font-bold text-gray-900">74%</div>
              <div className="text-xs text-green-600 font-medium mt-1">↑ 12% from last period</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
              {[
                { name: 'Your Brand', score: 74, own: true },
                { name: 'Competitor A', score: 61, own: false },
                { name: 'Competitor B', score: 43, own: false },
              ].map((b) => (
                <div key={b.name} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">{b.name}</span>
                      {b.own && <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium">You</span>}
                    </div>
                    <div className="mt-1 h-1.5 bg-gray-100 rounded-full">
                      <div className={cn('h-full rounded-full', b.own ? 'bg-indigo-500' : 'bg-gray-300')} style={{ width: `${b.score}%` }} />
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{b.score}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
