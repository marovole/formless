import { test as base, expect, type Page } from '@playwright/test'
import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright'

import en from '../../messages/en.json'
import zh from '../../messages/zh.json'

// ============================================================================
//  Environment gates
// ----------------------------------------------------------------------------
//  The app boots Clerk + Convex at module load, so even public pages need a
//  publishable key and a Convex URL. Authenticated specs additionally need a
//  seeded test user plus a way to sign in (Backend-API ticket via secret, or a
//  password). Specs read these flags to skip (not fail) when unprovisioned.
// ============================================================================
const has = (v: string | undefined): v is string => typeof v === 'string' && v.trim().length > 0

const clerkPublishableKey =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? process.env.CLERK_PUBLISHABLE_KEY

export const APP_ENV_AVAILABLE =
  has(process.env.BASE_URL) || (has(clerkPublishableKey) && has(process.env.NEXT_PUBLIC_CONVEX_URL))

export const AUTH_CREDS_AVAILABLE =
  has(clerkPublishableKey) &&
  has(process.env.E2E_USER_EMAIL) &&
  (has(process.env.CLERK_SECRET_KEY) || has(process.env.E2E_USER_PASSWORD))

// ============================================================================
//  Locale-aware UI text
// ----------------------------------------------------------------------------
//  The chat UI is internationalized: at /zh/chat the send button reads "发送",
//  not "Send". Drive selectors from the same message catalog the app renders so
//  tests follow the real DOM in every locale.
// ============================================================================
type Locale = 'zh' | 'en'
const messages: Record<Locale, typeof en> = { zh: zh as typeof en, en }

export const chatText = (locale: Locale) => messages[locale].chat

// ----------------------------------------------------------------------------
//  Shared, resilient locators (role + accessible name, not CSS class churn).
// ----------------------------------------------------------------------------
export const chatLocators = (page: Page, locale: Locale = 'zh') => {
  const t = chatText(locale)
  return {
    // The only textbox on the chat page is the composer.
    input: page.getByRole('textbox'),
    // The send button keeps a stable aria-label (t('send')) even while it shows
    // the "sending" label, so name-matching works in both states.
    sendButton: page.getByRole('button', { name: t.send }),
    userBubble: (text: string) =>
      page.getByRole('article', { name: t.userBubbleLabel }).filter({ hasText: text }),
    assistantBubbles: page.getByRole('article', { name: t.assistantBubbleLabel }),
    errorAlert: page.getByRole('alert'),
  }
}

// ----------------------------------------------------------------------------
//  Mock SSE payloads matching the real /api/chat contract (see useSSEChat.ts):
//  event: metadata -> chunk(s) -> complete. Mocking removes LLM latency/output
//  nondeterminism so assertions are deterministic. Metadata intentionally omits
//  conversationId: the chat page would otherwise fire a Convex read for that id,
//  re-coupling the test to the backend — we keep the streamed reply hermetic.
// ----------------------------------------------------------------------------
export const mockChatSSE = (reply: string) =>
  [
    `event: metadata\ndata: ${JSON.stringify({})}\n\n`,
    `event: chunk\ndata: ${JSON.stringify({ content: reply })}\n\n`,
    `event: complete\ndata: ${JSON.stringify({ done: true })}\n\n`,
  ].join('')

export const routeChatMock = (page: Page, reply: string) =>
  page.route('**/api/chat', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: mockChatSSE(reply),
    })
  )

// The authenticated suite runs against /zh/chat; login navigates accordingly.
const DEFAULT_LOCALE: Locale = 'zh'

export type ChatFixtures = {
  login: () => Promise<void>
}

export const test = base.extend<ChatFixtures>({
  login: async ({ page }, use) => {
    const locale = DEFAULT_LOCALE
    await use(async () => {
      const email = process.env.E2E_USER_EMAIL
      if (!email) {
        throw new Error('Missing E2E_USER_EMAIL — authenticated specs should be gated on AUTH_CREDS_AVAILABLE.')
      }

      // Bypass Clerk bot protection for this page, then load a Clerk-enabled
      // public page before signing in programmatically.
      await setupClerkTestingToken({ page })
      await page.goto(`/${locale}`)

      if (process.env.CLERK_SECRET_KEY) {
        // Backend-API ticket flow — most robust, no password required.
        await clerk.signIn({ page, emailAddress: email })
      } else {
        await clerk.signIn({
          page,
          signInParams: {
            strategy: 'password',
            identifier: email,
            password: process.env.E2E_USER_PASSWORD as string,
          },
        })
      }

      await page.goto(`/${locale}/chat`)
      await page.waitForURL(/\/(zh|en)\/chat/, { timeout: 30_000 })
    })
  },
})

export { expect }
