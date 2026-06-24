import { test, expect, APP_ENV_AVAILABLE } from '../fixtures/test-data'

// ============================================================================
//  Public-surface smoke suite — the always-on regression gate.
// ----------------------------------------------------------------------------
//  Covers routing, i18n, the sign-in page, and middleware auth protection: the
//  exact surfaces that broke in production before (see git history). No Clerk
//  session, no Convex data, no LLM — only a publishable key + Convex URL so the
//  app can boot. Skips (does not fail) when those are absent.
// ============================================================================
test.describe('Public surface', () => {
  test.skip(!APP_ENV_AVAILABLE, 'Needs NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY + NEXT_PUBLIC_CONVEX_URL (or BASE_URL).')

  test('root redirects to a localized home', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/(zh|en)\/?$/)
  })

  test('Chinese landing page renders', async ({ page }) => {
    await page.goto('/zh')
    await expect(page).toHaveURL(/\/zh\/?$/)
    await expect(page.getByRole('heading').first()).toBeVisible()
  })

  test('English landing page renders', async ({ page }) => {
    await page.goto('/en')
    await expect(page).toHaveURL(/\/en\/?$/)
    await expect(page.getByRole('heading').first()).toBeVisible()
  })

  test('sign-in page exposes an identifier/email field', async ({ page }) => {
    // This is the original MAR-12 symptom: the login form's input must be present.
    await page.goto('/zh/sign-in')
    await expect(page).toHaveURL(/\/zh\/sign-in/)
    await expect(page.getByRole('textbox').first()).toBeVisible({ timeout: 20_000 })
  })

  test('unauthenticated access to a protected route redirects to sign-in', async ({ page }) => {
    await page.goto('/zh/chat')
    await expect(page).toHaveURL(/\/zh\/sign-in/, { timeout: 20_000 })
  })

  test('landing page is usable on a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/zh')
    await expect(page.getByRole('heading').first()).toBeVisible()
  })
})
