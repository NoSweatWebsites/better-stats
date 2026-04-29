import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { getDb } from '@betterstats/db'
import { prompts } from '@betterstats/db'
import { eq } from 'drizzle-orm'

export default async function Home() {
  const { orgId } = await auth()
  if (!orgId) redirect('/dashboard') // Clerk will redirect to /login if not authed

  const db = getDb()
  const orgPrompts = await db.select().from(prompts).where(eq(prompts.organisationId, orgId)).limit(1)

  if (orgPrompts.length === 0) {
    redirect('/onboarding')
  }

  redirect('/dashboard')
}
