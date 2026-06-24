import {
  test,
  expect,
  AUTH_CREDS_AVAILABLE,
  chatLocators,
  routeChatMock,
} from '../fixtures/test-data'

// ============================================================================
//  Authenticated chat suite — runs only in a provisioned environment.
// ----------------------------------------------------------------------------
//  Requires a Clerk session (publishable key + test user + secret-or-password)
//  and a live Convex deployment. The /api/chat SSE stream is mocked so the LLM's
//  latency and nondeterministic output don't make the suite flaky — we assert
//  the UI contract (compose -> optimistic user bubble -> streamed assistant
//  reply -> error handling), not the model.
//
//  Selectors are locale-aware (the suite runs at /zh/chat where the send button
//  reads "发送") and role-based, so they track the real DOM, not class names.
// ============================================================================
test.describe('Authenticated chat', () => {
  test.skip(
    !AUTH_CREDS_AVAILABLE,
    'Needs Clerk publishable key + E2E_USER_EMAIL + (CLERK_SECRET_KEY or E2E_USER_PASSWORD).'
  )

  test.beforeEach(async ({ login, page }) => {
    await login()
    await page.goto('/zh/chat')
  })

  test('renders the chat composer for a signed-in user', async ({ page }) => {
    const ui = chatLocators(page, 'zh')
    await expect(ui.input).toBeVisible()
    await expect(ui.sendButton).toBeVisible()
  })

  test('sends a message and shows the streamed assistant reply', async ({ page }) => {
    const reply = '愿你心安。'
    await routeChatMock(page, reply)
    const ui = chatLocators(page, 'zh')

    const message = '你好，我想咨询一个问题'
    await ui.input.fill(message)
    await ui.sendButton.click()

    await expect(ui.userBubble(message)).toBeVisible()
    await expect(ui.assistantBubbles.last()).toContainText(reply)
  })

  test('sends a message with the Enter key', async ({ page }) => {
    await routeChatMock(page, '收到。')
    const ui = chatLocators(page, 'zh')

    const message = '使用回车发送'
    await ui.input.fill(message)
    await ui.input.press('Enter')

    await expect(ui.userBubble(message)).toBeVisible()
  })

  test('ignores empty and whitespace-only input', async ({ page }) => {
    const ui = chatLocators(page, 'zh')

    await ui.input.fill('')
    await ui.sendButton.click()
    await ui.input.fill('   ')
    await ui.sendButton.click()

    await expect(page.getByRole('article')).toHaveCount(0)
  })

  test('surfaces an error when the chat request fails', async ({ page }) => {
    await page.route('**/api/chat', (route) => route.abort('failed'))
    const ui = chatLocators(page, 'zh')

    await ui.input.fill('触发错误')
    await ui.sendButton.click()

    await expect(ui.errorAlert).toBeVisible()
  })
})
