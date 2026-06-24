import { clerkSetup } from '@clerk/testing/playwright'

/**
 * Global setup: fetch a Clerk testing token so programmatic clerk.signIn()
 * bypasses bot protection. No-op when no publishable key is available — in that
 * case only public smoke specs run, and they don't need a Clerk session.
 */
export default async function globalSetup() {
  const publishableKey =
    process.env.CLERK_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

  if (!publishableKey) {
    return
  }

  if (!process.env.CLERK_PUBLISHABLE_KEY) {
    process.env.CLERK_PUBLISHABLE_KEY = publishableKey
  }

  await clerkSetup({ publishableKey })
}
