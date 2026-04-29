'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const MODELS = [
  { id: 'claude', label: 'Claude', description: 'Anthropic Claude Opus', color: 'bg-orange-50 border-orange-200 text-orange-700' },
  { id: 'chatgpt', label: 'ChatGPT', description: 'OpenAI GPT-4o', color: 'bg-green-50 border-green-200 text-green-700' },
  { id: 'gemini', label: 'Gemini', description: 'Google Gemini 2.0 Flash', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  { id: 'perplexity', label: 'Perplexity', description: 'Sonar (with citations)', color: 'bg-purple-50 border-purple-200 text-purple-700' },
  { id: 'google_aio', label: 'Google AIO', description: 'AI Overviews via SerpAPI', color: 'bg-red-50 border-red-200 text-red-700' },
]

export default function ModelsSettingsPage() {
  const [selected, setSelected] = useState<string[]>(['claude', 'chatgpt', 'gemini', 'perplexity'])

  function toggle(id: string) {
    setSelected((prev) => prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id])
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">AI Models</h1>
      <p className="text-sm text-gray-500 mb-6">Choose which models to include when running scans.</p>

      <div className="grid grid-cols-2 gap-3">
        {MODELS.map((model) => {
          const active = selected.includes(model.id)
          return (
            <button
              key={model.id}
              onClick={() => toggle(model.id)}
              className={cn(
                'flex items-start justify-between p-4 rounded-xl border-2 text-left transition-all',
                active ? `${model.color} border-current` : 'border-gray-200 bg-white text-gray-400'
              )}
            >
              <div>
                <div className="font-medium text-sm">{model.label}</div>
                <div className="text-xs mt-0.5 opacity-70">{model.description}</div>
              </div>
              {active && <Check size={16} className="shrink-0 mt-0.5" />}
            </button>
          )
        })}
      </div>

      <p className="mt-4 text-xs text-gray-400">
        Model selection is saved per scan. Changes apply to the next scan you run.
      </p>
    </div>
  )
}
