const BASE = 'https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/light'

const MODEL_IMAGES: Record<string, string> = {
  claude:     `${BASE}/claude-color.png`,
  chatgpt:    `${BASE}/openai.png`,
  gemini:     `${BASE}/gemini-color.png`,
  perplexity: `${BASE}/perplexity-color.png`,
  google_aio: `${BASE}/google-color.png`,
}

export const MODEL_LABELS: Record<string, string> = {
  claude:     'Claude',
  chatgpt:    'ChatGPT',
  gemini:     'Gemini',
  perplexity: 'Perplexity',
  google_aio: 'Google AIO',
}

export function ModelIcon({ model, size = 20 }: { model: string; size?: number }) {
  const src = MODEL_IMAGES[model]
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={MODEL_LABELS[model] ?? model} width={size} height={size} className="rounded-sm" />
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-gray-100 text-[9px] font-bold text-gray-500"
      style={{ width: size, height: size }}
    >
      {model.slice(0, 2).toUpperCase()}
    </span>
  )
}

export function ModelIconGroup({ models }: { models: string[] }) {
  return (
    <div className="flex items-center gap-1.5">
      {models.map((m) => <ModelIcon key={m} model={m} size={18} />)}
    </div>
  )
}
