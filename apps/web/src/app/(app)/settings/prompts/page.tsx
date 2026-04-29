'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, Plus, Loader2, Sparkles, X, Check } from 'lucide-react'

type Prompt = { id: string; text: string; createdAt: string }

function GenerateModal({ onClose, onAdd, existingTexts }: {
  onClose: () => void
  onAdd: (prompts: Prompt[]) => void
  existingTexts: string[]
}) {
  const [description, setDescription] = useState('')
  const [generating, setGenerating] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    setGenerating(true)
    setError('')
    setSuggestions([])
    setSelected(new Set())
    try {
      const res = await fetch('/api/prompts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      })
      const data = await res.json()
      setSuggestions(data.prompts ?? [])
      setSelected(new Set((data.prompts ?? []).map((_: string, i: number) => i)))
    } catch {
      setError('Failed to generate prompts. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  async function addSelected() {
    const toAdd = suggestions.filter((_, i) => selected.has(i))
    setSaving(true)
    const added: Prompt[] = []
    for (const text of toAdd) {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (res.ok) added.push(await res.json())
    }
    onAdd(added)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="bs-scale-in relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-(--border)">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-(--primary)" />
            <h2 className="text-base font-semibold text-(--foreground)">Generate prompts with AI</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 flex-1 overflow-y-auto">
          <p className="text-sm text-(--muted-2) mb-4">
            Optionally describe your product or use case and Claude will generate prompts your potential customers search for.
          </p>
          <div className="flex gap-2 mb-2">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. B2B project management SaaS for agencies"
              onKeyDown={(e) => e.key === 'Enter' && !generating && generate()}
              className="flex-1"
            />
            <Button onClick={generate} disabled={generating} size="sm" className="shrink-0">
              {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {generating ? 'Generating…' : 'Generate'}
            </Button>
          </div>

          {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

          {suggestions.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-(--muted-2) uppercase tracking-wide">
                  {suggestions.length} suggestions — click to deselect
                </p>
                <button
                  className="text-xs text-(--primary) hover:underline"
                  onClick={() =>
                    setSelected(
                      selected.size === suggestions.length
                        ? new Set()
                        : new Set(suggestions.map((_, i) => i))
                    )
                  }
                >
                  {selected.size === suggestions.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="space-y-1.5">
                {suggestions.map((text, i) => {
                  const isExisting = existingTexts.includes(text)
                  const isSelected = selected.has(i)
                  return (
                    <button
                      key={i}
                      onClick={() => !isExisting && toggle(i)}
                      disabled={isExisting}
                      className={[
                        'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-all text-sm',
                        isExisting
                          ? 'border-(--border) bg-(--surface-2) opacity-50 cursor-not-allowed'
                          : isSelected
                          ? 'border-[color-mix(in_srgb,var(--primary)_35%,white)] bg-[color-mix(in_srgb,var(--primary)_12%,white)] text-(--foreground)'
                          : 'border-(--border) bg-(--surface) text-(--muted-2) hover:border-[color-mix(in_srgb,var(--primary)_18%,white)]',
                      ].join(' ')}
                    >
                      <span className={[
                        'mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center',
                        isSelected ? 'bg-(--primary) border-(--primary)' : 'border-(--border)',
                      ].join(' ')}>
                        {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                      </span>
                      <span className="leading-snug">{text}</span>
                      {isExisting && <span className="ml-auto text-xs text-(--muted-2) shrink-0">already tracked</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {suggestions.length > 0 && (
          <div className="px-6 py-4 border-t border-(--border) flex items-center justify-between">
            <p className="text-xs text-(--muted-2)">{selected.size} of {suggestions.length} selected</p>
            <Button
              onClick={addSelected}
              disabled={selected.size === 0 || saving}
              size="sm"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add selected ({selected.size})
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PromptsSettingsPage() {
  const router = useRouter()
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [newText, setNewText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showGenerator, setShowGenerator] = useState(false)

  useEffect(() => {
    fetch('/api/prompts', { cache: 'no-store' }).then((r) => r.json()).then((data) => { setPrompts(data); setLoading(false) })
  }, [])

  async function addPrompt() {
    if (!newText.trim()) return
    setSaving(true)
    const res = await fetch('/api/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: newText.trim() }),
    })
    const row = await res.json()
    setPrompts((p) => [...p, row])
    setNewText('')
    setSaving(false)
  }

  async function deletePrompt(id: string) {
    await fetch(`/api/prompts/${id}`, { method: 'DELETE' })
    setPrompts((p) => p.filter((x) => x.id !== id))
    router.refresh()
  }

  function handleGenerated(added: Prompt[]) {
    setPrompts((p) => [...p, ...added])
    setShowGenerator(false)
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-(--foreground) mb-1">Tracked Prompts</h1>
          <p className="text-sm text-(--muted-2)">These prompts are sent to each AI model during a scan.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowGenerator(true)}
          className="flex items-center gap-1.5"
        >
          <Sparkles size={14} />
          Generate with AI
        </Button>
      </div>

      <div className="flex gap-2 mb-6">
        <Input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="e.g. best CRM for small business"
          onKeyDown={(e) => e.key === 'Enter' && addPrompt()}
        />
        <Button onClick={addPrompt} disabled={!newText.trim() || saving} size="sm">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Add
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-20">
          <Loader2 className="animate-spin text-(--border)" size={20} />
        </div>
      ) : prompts.length === 0 ? (
        <p className="text-sm text-(--muted-2)">No prompts yet.</p>
      ) : (
        <div className="space-y-2">
          {prompts.map((p) => (
            <div key={p.id} className="flex items-center justify-between bg-(--surface) border border-(--border) rounded-lg px-4 py-3">
              <span className="text-sm text-(--muted)">{p.text}</span>
              <button onClick={() => deletePrompt(p.id)} className="text-gray-300 hover:text-red-400 transition-colors ml-4">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showGenerator && (
        <GenerateModal
          onClose={() => setShowGenerator(false)}
          onAdd={handleGenerated}
          existingTexts={prompts.map((p) => p.text)}
        />
      )}
    </div>
  )
}
