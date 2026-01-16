import { test as base, expect } from '@playwright/test'

import { clerk, clerkSetup } from '@clerk/testing/playwright'

let clerkReady = false

const ensureClerkSetup = async () => {
  if (clerkReady) {
    return
  }

  const publishableKey =
    process.env.CLERK_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

  if (publishableKey && !process.env.CLERK_PUBLISHABLE_KEY) {
    process.env.CLERK_PUBLISHABLE_KEY = publishableKey
  }

  await clerkSetup({ publishableKey })
  clerkReady = true
}

export type ChatFixtures = {
  chatPage: string
  login: () => Promise<void>
}

export const test = base.extend<ChatFixtures>({
  chatPage: async ({ page }, use) => {
    void page
    await use('/zh/chat')
  },
  login: async ({ page }, use) => {
    await use(async () => {
      const email = process.env.E2E_USER_EMAIL
      const password = process.env.E2E_USER_PASSWORD

      if (!email || !password) {
        throw new Error('Missing E2E credentials. Set E2E_USER_EMAIL and E2E_USER_PASSWORD.')
      }

      await page.goto('/zh/sign-in')

      await ensureClerkSetup()

      await clerk.signIn({
        page,
        signInParams: {
          strategy: 'password',
          identifier: email,
          password,
        },
      })

      await page.goto('/zh/chat')
      await page.waitForURL(/\/(zh|en)\/chat|\/chat/, { timeout: 30000 })
    })
  },
})

export { expect }
