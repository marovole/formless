import { defineConfig, devices } from '@playwright/test'

const shouldRunWebServer = !process.env.BASE_URL
const baseURL = process.env.BASE_URL || 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['junit', { outputFile: 'test-results/junit.xml' }]],
  // Wire Clerk's testing token setup so programmatic clerk.signIn() works.
  globalSetup: './e2e/global.setup.ts',
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: shouldRunWebServer
    ? {
        command: 'npm run dev',
        // Wait on a real public, localized page (root "/" redirects and is not a
        // reliable readiness signal). A first-request cold compile of the locale
        // layout can be slow, so allow generous startup time.
        url: `${baseURL}/zh`,
        reuseExistingServer: !process.env.CI,
        timeout: 180 * 1000,
      }
    : undefined,
})
