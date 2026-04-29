import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: Request) {
  const { orgId } = await auth()
  if (!orgId) return new NextResponse('Unauthorized', { status: 401 })

  const { companyName, domain } = await req.json()

  const client = new Anthropic()
  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: `Generate 3 short search prompts someone might type into an AI assistant to find a company like "${companyName}" (domain: ${domain}). Return only a JSON array of 3 strings, nothing else. Example: ["best CRM for small business", "affordable project management tool", "team collaboration software for startups"]`,
      },
    ],
  })

  const text = message.content.filter((b) => b.type === 'text').map((b) => (b as { type: 'text'; text: string }).text).join('')

  try {
    const prompts = JSON.parse(text)
    return NextResponse.json({ prompts })
  } catch {
    return NextResponse.json({ prompts: [] })
  }
}
