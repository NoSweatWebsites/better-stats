import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

export type LLMResult = {
  text: string
  citations: string[] // URLs for Perplexity, empty for others
}

export async function callClaude(prompt: string): Promise<LLMResult> {
  const client = new Anthropic()
  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = response.content.filter((b) => b.type === 'text').map((b) => (b as { type: 'text'; text: string }).text).join('')
  return { text, citations: [] }
}

export async function callChatGPT(prompt: string): Promise<LLMResult> {
  const client = new OpenAI()
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
  })
  const text = response.choices[0].message.content ?? ''
  return { text, citations: [] }
}

export async function callGemini(prompt: string): Promise<LLMResult> {
  const client = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
  const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' })

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await model.generateContent(prompt)
      return { text: result.response.text(), citations: [] }
    } catch (err: any) {
      const isRateLimit = err?.status === 429
      const isQuotaExhausted = isRateLimit && /quota/i.test(err?.message ?? '')
      // Quota exhaustion won't recover with a retry — bail immediately
      if (isQuotaExhausted) throw err
      if (isRateLimit && attempt < 2) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 8000))
      } else {
        throw err
      }
    }
  }
  throw new Error('Gemini retry exhausted')
}

export async function callPerplexity(prompt: string): Promise<LLMResult> {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await response.json() as { choices: { message: { content: string } }[]; citations?: string[] }
  const text = data.choices[0].message.content ?? ''
  const citations: string[] = data.citations ?? []
  return { text, citations }
}

export async function callGoogleAIO(prompt: string): Promise<LLMResult> {
  const params = new URLSearchParams({
    q: prompt,
    api_key: process.env.SERP_API_KEY!,
    engine: 'google',
    gl: 'gb',
    hl: 'en',
  })
  const response = await fetch(`https://serpapi.com/search.json?${params}`)
  const data = await response.json() as {
    ai_overview?: { text_blocks?: { snippet?: string }[] }
    organic_results?: { link?: string }[]
  }

  // Extract AI Overview text
  const blocks = data.ai_overview?.text_blocks ?? []
  const text = blocks.map((b) => b.snippet ?? '').filter(Boolean).join('\n\n')

  // Return full URLs so index.ts can extract domains consistently (same as Perplexity)
  const citations = (data.organic_results ?? [])
    .slice(0, 8)
    .map((r) => r.link ?? '')
    .filter((url) => url.startsWith('http'))

  // No AIO for this query — store as empty completion (0 mentions is valid signal)
  return { text: text || '', citations }
}

export async function callModel(model: string, prompt: string): Promise<LLMResult> {
  switch (model) {
    case 'claude': return callClaude(prompt)
    case 'chatgpt': return callChatGPT(prompt)
    case 'gemini': return callGemini(prompt)
    case 'perplexity': return callPerplexity(prompt)
    case 'google_aio': return callGoogleAIO(prompt)
    default: throw new Error(`Unknown model: ${model}`)
  }
}
