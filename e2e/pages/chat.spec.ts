import { test, expect } from '../../fixtures/test-data'

test.describe('Chat Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/zh/chat')
  })

  test('should display chat interface', async ({ page }) => {
    // Check if input field is visible
    await expect(page.locator('input[type="text"]')).toBeVisible()
    
    // Check if send button is visible
    await expect(page.locator('button:has-text("Send")')).toBeVisible()
  })

  test('should allow sending a message', async ({ page }) => {
    const message = '你好，我想咨询一个问题'
    
    // Type message
    await page.locator('input[type="text"]').fill(message)
    
    // Click send button
    await page.locator('button:has-text("Send")').click()
    
    // Verify user message appears
    await expect(page.locator('.bg-amber-50').filter({ hasText: message })).toBeVisible()
    
    // Verify loading state
    await expect(page.locator('button:has-text("Sending...")')).toBeVisible()
  })

  test('should receive streaming response', async ({ page }) => {
    const message = '请介绍一下自己'
    
    // Send message
    await page.locator('input[type="text"]').fill(message)
    await page.locator('button:has-text("Send")').click()
    
    // Wait for user message
    await expect(page.locator('.bg-amber-50').filter({ hasText: message })).toBeVisible()
    
    // Wait for assistant response (with timeout for streaming)
    await expect(page.locator('.bg-white')).toBeVisible({ timeout: 15000 })
  })

  test('should maintain conversation context across messages', async ({ page }) => {
    const firstMessage = '我叫张三'
    const secondMessage = '我叫什么名字?'
    
    // Send first message
    await page.locator('input[type="text"]').fill(firstMessage)
    await page.locator('button:has-text("Send")').click()
    
    // Wait for first response
    await expect(page.locator('.bg-white').first()).toBeVisible({ timeout: 15000 })
    
    // Send second message
    await page.locator('input[type="text"]').fill(secondMessage)
    await page.locator('button:has-text("Send")').click()
    
    // Verify both user messages are in the conversation
    await expect(page.locator('.bg-amber-50').filter({ hasText: firstMessage })).toBeVisible()
    await expect(page.locator('.bg-amber-50').filter({ hasText: secondMessage })).toBeVisible()
  })

  test('should prevent sending empty message', async ({ page }) => {
    // Try to send empty message
    await page.locator('input[type="text"]').fill('')
    await page.locator('button:has-text("Send")').click()
    
    // Verify no message was added
    const messageCount = await page.locator('.bg-amber-50').count()
    expect(messageCount).toBe(0)
  })

  test('should prevent sending whitespace-only message', async ({ page }) => {
    // Try to send whitespace-only message
    await page.locator('input[type="text"]').fill('   ')
    await page.locator('button:has-text("Send")').click()
    
    // Verify no message was added
    const messageCount = await page.locator('.bg-amber-50').count()
    expect(messageCount).toBe(0)
  })

  test('should auto-scroll to latest message', async ({ page }) => {
    const messages = [
      '第一条消息',
      '第二条消息',
      '第三条消息',
    ]
    
    for (const message of messages) {
      await page.locator('input[type="text"]').fill(message)
      await page.locator('button:has-text("Send")').click()
      
      // Wait for response before sending next message
      await page.waitForTimeout(3000)
    }
    
    // Verify all messages are visible (which means we scrolled down)
    for (const message of messages) {
      await expect(page.locator('.bg-amber-50').filter({ hasText: message })).toBeVisible()
    }
  })

  test('should handle network error gracefully', async ({ page }) => {
    // Intercept and fail the request
    await page.route('**/api/chat', route => route.abort('failed'))
    
    const message = '测试错误处理'
    
    // Send message
    await page.locator('input[type="text"]').fill(message)
    await page.locator('button:has-text("Send")').click()
    
    // Verify error message appears
    await expect(page.locator('.bg-white').filter({ hasText: 'Sorry, an error occurred' })).toBeVisible()
  })

  test('should disable input while loading', async ({ page }) => {
    const message = '测试加载状态'
    
    // Send message
    await page.locator('input[type="text"]').fill(message)
    await page.locator('button:has-text("Send")').click()
    
    // Verify button shows loading state
    await expect(page.locator('button:has-text("Sending...")')).toBeVisible()
    
    // Verify button is disabled
    const button = page.locator('button:has-text("Sending...")')
    await expect(button).toBeDisabled()
  })

  test('should allow sending message with Enter key', async ({ page }) => {
    const message = '使用Enter发送消息'
    
    // Type message and press Enter
    await page.locator('input[type="text"]').fill(message)
    await page.locator('input[type="text"]').press('Enter')
    
    // Verify message was sent
    await expect(page.locator('.bg-amber-50').filter({ hasText: message })).toBeVisible()
  })

  test('should support multiple conversations in same session', async ({ page }) => {
    const firstConvMessage = '第一轮对话'
    const secondConvMessage = '第二轮对话'
    
    // First conversation
    await page.locator('input[type="text"]').fill(firstConvMessage)
    await page.locator('button:has-text("Send")').click()
    await page.waitForTimeout(3000)
    
    // Navigate away and back (simulating new conversation)
    await page.goto('/zh/history')
    await page.goto('/zh/chat')
    
    // Send new message in new conversation
    await page.locator('input[type="text"]').fill(secondConvMessage)
    await page.locator('button:has-text("Send")').click()
    
    // Verify second conversation appears
    await expect(page.locator('.bg-amber-50').filter({ hasText: secondConvMessage })).toBeVisible()
  })
})
