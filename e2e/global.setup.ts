import { clerkSetup } from '@clerk/testing/playwright'

export default async function globalSetup() {
  const publishableKey =
    process.env.CLERK_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

  if (publishableKey && !process.env.CLERK_PUBLISHABLE_KEY) {
    process.env.CLERK_PUBLISHABLE_KEY = publishableKey
  }

  await clerkSetup({ publishableKey })
}
