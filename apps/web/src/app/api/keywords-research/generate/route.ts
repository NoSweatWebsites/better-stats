import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getDb, keywordResearchReports, organisations } from '@betterstats/db'

type KeywordsResearchRequest = {
  niche?: string
  targetAudience?: string
  businessGoal?: string
  targetMarket?: string
  siteStage?: string
  websiteUrl?: string
  brandContext?: string
  existingContent?: string
  reportAudience?: string
  competitors?: string[]
}

const KEYWORD_RESEARCH_SKILL = `
SEO Keyword Research Without Expensive Tools:
- Collect niche, target audience, business goal, existing content, geography, and site maturity.
- Start with strategy first, then generate seed keywords and validate with directional demand signals.
- Apply the 6 Circles method: one primary keyword, three supporting subtopics, and nine specific content pieces.
- Use varied content types matched to intent: how-to, comparison, list, case study, trend, expert roundup, beginner guide, tool review, problem-solution.
- Score opportunity using demand, competition, intent fit, and opportunity.
- For new sites, bias toward long-tail, lower competition, high-intent topics.
- Never guarantee rankings, traffic, leads, or sales.
- If exact keyword metrics are unavailable, mark them as estimated and explain how to validate.
`

const SEO_STRATEGY_ENGINE_SKILL = `
SEO Strategy Engine:
- Generate a commercially useful organic growth strategy from niche, audience, business goal, keyword data, SERP analysis, page analysis, content gaps, and execution planning.
- Phase 1: choose one primary keyword, three intent-separated subtopics, and nine supporting content ideas.
- Phase 2: expand to 50-100 keyword ideas when keyword data is available.
- Phase 3: perform a SERP reality check for priority keywords, including intent, depth, freshness, authority proxy, weak pages, missing sections, and AI-content vulnerability.
- Phase 4: score every keyword from 1-10 for demand, organic difficulty, intent fit, business value, and SERP weakness. Opportunity score = demand + intent fit + business value + SERP weakness - organic difficulty.
- Phase 5: output executive summary, keyword clusters, priority table, quick wins, content pillars, slug recommendations, SERP gaps, AI competition audit, internal linking plan, social distribution ideas, 14-day sprint, and 30/60/90-day timeline.
- Be commercially decisive. Do not produce a generic keyword dump. Always explain why a keyword matters and what not to pursue.
`

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 4000) : ''
}

function cleanList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => cleanText(item)).filter(Boolean).slice(0, 8)
    : []
}

export async function POST(req: Request) {
  const { orgId, orgSlug } = await auth()
  if (!orgId) return new NextResponse('Unauthorized', { status: 401 })

  const body = (await req.json()) as KeywordsResearchRequest
  const brief = {
    niche: cleanText(body.niche),
    targetAudience: cleanText(body.targetAudience),
    businessGoal: cleanText(body.businessGoal),
    targetMarket: cleanText(body.targetMarket),
    siteStage: cleanText(body.siteStage),
    websiteUrl: cleanText(body.websiteUrl),
    brandContext: cleanText(body.brandContext),
    existingContent: cleanText(body.existingContent),
    reportAudience: cleanText(body.reportAudience),
    competitors: cleanList(body.competitors),
  }

  if (!brief.niche || !brief.targetAudience || !brief.businessGoal) {
    return NextResponse.json(
      { error: 'Niche, target audience, and business goal are required.' },
      { status: 400 }
    )
  }

  const client = new Anthropic()
  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are the BetterStats Keywords Research agent.

Use these two project skill instructions:

${KEYWORD_RESEARCH_SKILL}

${SEO_STRATEGY_ENGINE_SKILL}

Current app data status:
- Google Ads keyword metrics are not connected in this request.
- Live SERP fetching is not connected in this request.
- Ranking page scraping is not connected in this request.
- You may provide estimated directional volume, difficulty, and SERP weakness, but label estimates clearly.

User brief:
${JSON.stringify(brief, null, 2)}

Return ONLY a polished markdown report. Use this exact section order:

# Keyword Research: [niche]
## Executive Summary
## Working Assumptions
## Primary Growth Opportunity
## 6 Circles Content Plan
## Priority Keyword Queue
Include a markdown table with: Priority, Topic, Keyword, Intent, Demand, Difficulty, Business Value, SERP Weakness, Opportunity, Why it matters.
## Quick Wins
## Content Gaps To Exploit
## Recommended Pages And Slugs
## Internal Linking Plan
## What Not To Pursue
## 14-Day Sprint Plan
## 30/60/90-Day Roadmap
## Data Needed To Validate

Rules:
- Make clear decisions, not a broad keyword dump.
- Prioritize business impact over traffic alone.
- Use the 6 Circles structure: one primary keyword, three subtopics, nine supporting articles.
- Do not claim live Google Ads or SERP data was used.
- Do not guarantee rankings or revenue.
- Keep the report concise enough to be read by a client in under 10 minutes.`,
      },
    ],
  })

  const markdown = message.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('')

  const db = getDb()
  await db
    .insert(organisations)
    .values({ id: orgId, name: orgSlug ?? orgId })
    .onConflictDoNothing()

  const [report] = await db
    .insert(keywordResearchReports)
    .values({
      organisationId: orgId,
      title: brief.niche,
      brief: JSON.stringify(brief),
      markdown,
    })
    .returning()

  return NextResponse.json({ report, markdown })
}
