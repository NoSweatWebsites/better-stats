import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { getDb, prompts } from '@betterstats/db'
import { eq } from 'drizzle-orm'
import { OnboardingFlow } from './onboarding-flow'

export default async function OnboardingPage() {
  const { orgId } = await auth()
  if (!orgId) redirect('/login')

  const db = getDb()
  const existing = await db.select().from(prompts).where(eq(prompts.organisationId, orgId)).limit(1)
  if (existing.length > 0) redirect('/dashboard')

  return <OnboardingFlow />
}
