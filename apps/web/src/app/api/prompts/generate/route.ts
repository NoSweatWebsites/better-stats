import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getDb, brands, prompts } from '@betterstats/db'
import { eq } from 'drizzle-orm'

export async function POST(req: Request) {
  const { orgId } = await auth()
  if (!orgId) return new NextResponse('Unauthorized', { status: 401 })

  const { description } = await req.json()

  const db = getDb()
  const [orgBrands, orgPrompts] = await Promise.all([
    db.select().from(brands).where(eq(brands.organisationId, orgId)),
    db.select().from(prompts).where(eq(prompts.organisationId, orgId)),
  ])

  const ownBrand = orgBrands.find((b) => b.isOwnBrand)
  const competitors = orgBrands.filter((b) => !b.isOwnBrand).map((b) => b.name)
  const existingPrompts = orgPrompts.map((p) => p.text)

  const context = [
    ownBrand ? `Brand: ${ownBrand.name}` : '',
    description ? `Description: ${description}` : '',
    competitors.length ? `Competitors: ${competitors.join(', ')}` : '',
    existingPrompts.length ? `Already tracking: ${existingPrompts.slice(0, 5).join(' | ')}` : '',
  ].filter(Boolean).join('\n')

  const client = new Anthropic()
  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Generate 12 search prompts someone would type into an AI assistant (like ChatGPT or Claude) when looking for a product or service like the one described below. These prompts will be used to track brand visibility in AI responses.

${context}

Rules:
- Write prompts as natural search queries, not questions with question marks
- Mix: "best X for Y", "top X tools", "alternatives to [competitor]", "X for [use case]", "how to choose X"
- Make them specific enough to return relevant results
- Do NOT duplicate any already-tracked prompts
- Return ONLY a JSON array of 12 strings, no explanation

Example format: ["best CRM for small business", "top project management tools for remote teams"]`,
      },
    ],
  })

  const text = message.content.filter((b) => b.type === 'text').map((b) => (b as { type: 'text'; text: string }).text).join('')

  try {
    const generated = JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] ?? '[]') as string[]
    const deduped = generated.filter((p) => !existingPrompts.includes(p))
    return NextResponse.json({ prompts: deduped })
  } catch {
    return NextResponse.json({ prompts: [] })
  }
}
