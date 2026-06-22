// ============================================================================
//  E2E runner gate
// ----------------------------------------------------------------------------
//  The Next app boots Clerk + Convex providers at module load
//  (`new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)`, `<ClerkProvider>`).
//  Without a Clerk publishable key AND a Convex URL, every route 500s, the dev
//  server never becomes ready, and Playwright hangs until its webServer timeout.
//
//  So: run Playwright only when the app can actually boot. Otherwise print a
//  clear notice and exit 0 — `npm run test:all` stays green on unprovisioned
//  machines (local dev, sandboxes), while CI/验收 that supplies the secrets gets
//  the full browser regression gate. One decision point, no scattered skips.
// ============================================================================
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const has = (v) => typeof v === 'string' && v.trim().length > 0

const clerkPublishableKey =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? process.env.CLERK_PUBLISHABLE_KEY
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
const baseUrl = process.env.BASE_URL

// When BASE_URL points at an already-running deployment we don't boot a local
// server, so the local env vars are not required to reach the app.
const canBootApp = has(baseUrl) || (has(clerkPublishableKey) && has(convexUrl))

if (!canBootApp) {
  const missing = []
  if (!has(clerkPublishableKey)) missing.push('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY')
  if (!has(convexUrl)) missing.push('NEXT_PUBLIC_CONVEX_URL')

  console.log('')
  console.log('[e2e] Skipping Playwright E2E — environment not provisioned.')
  console.log(`[e2e] Missing: ${missing.join(', ')}`)
  console.log('[e2e] Public smoke specs need the two vars above; authenticated chat')
  console.log('[e2e] specs also need E2E_USER_EMAIL and (CLERK_SECRET_KEY or E2E_USER_PASSWORD).')
  console.log('[e2e] Supply them in CI/验收 to run the full browser regression gate.')
  console.log('[e2e] Unit tests (npm run test:run) are the local gate; test:all stays green.')
  console.log('')
  process.exit(0)
}

const playwrightCli = require.resolve('@playwright/test/cli')
const result = spawnSync(process.execPath, [playwrightCli, 'test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
})

if (result.error) {
  console.error('[e2e] Failed to launch Playwright:', result.error.message)
  process.exit(1)
}

process.exit(result.status ?? 1)
