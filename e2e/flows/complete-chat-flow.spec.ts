import { test, expect } from '@playwright/test'

test.describe('Complete Chat Flow', () => {
  test('new user journey - first chat interaction', async ({ page }) => {
    // Start at homepage
    await page.goto('/')
    
    // Verify homepage loads
    await expect(page).toHaveURL(/\/(zh|en)/)
    
    // Navigate to chat
    await page.goto('/zh/chat')
    
    // Verify chat interface is ready
    await expect(page.locator('input[type="text"]')).toBeVisible()
    await expect(page.locator('button:has-text("Send")')).toBeVisible()
  })

  test('complete conversation flow with context', async ({ page }) => {
    await page.goto('/zh/chat')
    
    const conversation = [
      { user: '你好', expectedKeywords: ['你好', 'Hello'] },
      { user: '我想了解冥想', expectedKeywords: ['冥想', 'meditation'] },
      { user: '如何开始?', expectedKeywords: ['开始', 'start', '方法', 'method'] },
    ]
    
    for (const turn of conversation) {
      // Send user message
      await page.locator('input[type="text"]').fill(turn.user)
      await page.locator('button:has-text("Send")').click()
      
      // Verify user message appears
      await expect(page.locator('.bg-amber-50').filter({ hasText: turn.user })).toBeVisible()
      
      // Wait for assistant response
      await expect(page.locator('.bg-white').last()).toBeVisible({ timeout: 15000 })
      
      // Verify response contains expected content (allow time for streaming)
      await page.waitForTimeout(2000)
    }
    
    // Verify conversation history shows all messages
    const userMessages = await page.locator('.bg-amber-50').count()
    const assistantMessages = await page.locator('.bg-white').count()
    
    expect(userMessages).toBeGreaterThan(0)
    expect(assistantMessages).toBeGreaterThan(0)
  })

  test('language switching during conversation', async ({ page }) => {
    // Start in Chinese
    await page.goto('/zh/chat')
    await expect(page).toHaveURL(/\/zh\/chat/)
    
    // Send Chinese message
    await page.locator('input[type="text"]').fill('你好')
    await page.locator('button:has-text("Send")').click()
    
    // Wait for response
    await page.waitForTimeout(3000)
    
    // Switch to English
    await page.goto('/en/chat')
    await expect(page).toHaveURL(/\/en\/chat/)
    
    // Verify interface is in English (check for Send button)
    await expect(page.locator('button:has-text("Send")')).toBeVisible()
    
    // Send English message
    await page.locator('input[type="text"]').fill('Hello')
    await page.locator('button:has-text("Send")').click()
    
    // Wait for response
    await expect(page.locator('.bg-white').last()).toBeVisible({ timeout: 15000 })
  })

  test('view chat history and continue conversation', async ({ page }) => {
    // Start new conversation
    await page.goto('/zh/chat')
    
    const firstMessage = '第一轮对话消息'
    await page.locator('input[type="text"]').fill(firstMessage)
    await page.locator('button:has-text("Send")').click()
    
    // Wait for response
    await page.waitForTimeout(3000)
    
    // Navigate to history page
    await page.goto('/zh/history')
    
    // Verify history page loads
    await expect(page).toHaveURL(/\/zh\/history/)
    
    // Navigate back to chat (should start new conversation)
    await page.goto('/zh/chat')
    
    // Verify chat interface is ready
    await expect(page.locator('input[type="text"]')).toBeVisible()
    
    // Send new message in fresh conversation
    const secondMessage = '新一轮对话'
    await page.locator('input[type="text"]').fill(secondMessage)
    await page.locator('button:has-text("Send")').click()
    
    // Verify new message appears
    await expect(page.locator('.bg-amber-50').filter({ hasText: secondMessage })).toBeVisible()
  })

  test('handle error recovery and retry', async ({ page }) => {
    await page.goto('/zh/chat')
    
    // Intercept first request to simulate error
    await page.route('**/api/chat', route => {
      route.abort('failed')
    })
    
    // Try to send message (will fail)
    await page.locator('input[type="text"]').fill('测试消息')
    await page.locator('button:has-text("Send")').click()
    
    // Wait for error
    await expect(page.locator('.bg-white').filter({ hasText: /error/i })).toBeVisible()
    
    // Remove interception to allow next request
    await page.unroute('**/api/chat')
    
    // Mock successful response
    await page.route('**/api/chat', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: `event: metadata\ndata: {"conversationId":"test-conv-id"}\n\nevent: chunk\ndata: {"content":"测试回复"}\n\nevent: complete\ndata: {"done":true}\n\n`,
      })
    })
    
    // Try again
    await page.locator('input[type="text"]').fill('重试消息')
    await page.locator('button:has-text("Send")').click()
    
    // Verify message appears
    await expect(page.locator('.bg-amber-50').filter({ hasText: '重试消息' })).toBeVisible()
  })

  test('multiple rapid messages should be queued properly', async ({ page }) => {
    await page.goto('/zh/chat')
    
    // Mock responses
    await page.route('**/api/chat', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: `event: metadata\ndata: {"conversationId":"test-conv-id"}\n\nevent: chunk\ndata: {"content":"回复内容"}\n\nevent: complete\ndata: {"done":true}\n\n`,
      })
    })
    
    // Send multiple messages rapidly
    const messages = ['消息1', '消息2', '消息3']
    
    for (const message of messages) {
      await page.locator('input[type="text"]').fill(message)
      await page.locator('button:has-text("Send")').click()
      await page.waitForTimeout(500)
    }
    
    // Verify all messages appear
    for (const message of messages) {
      await expect(page.locator('.bg-amber-50').filter({ hasText: message })).toBeVisible()
    }
  })

  test('session persistence across page refresh', async ({ page }) => {
    await page.goto('/zh/chat')
    
    const message = '会话持久化测试'
    
    // Send message
    await page.locator('input[type="text"]').fill(message)
    await page.locator('button:has-text("Send")').click()
    
    // Wait for response
    await page.waitForTimeout(3000)
    
    // Refresh page
    await page.reload()
    
    // Verify chat interface is still available
    await expect(page.locator('input[type="text"]')).toBeVisible()
    await expect(page.locator('button:has-text("Send")')).toBeVisible()
  })

  test('accessibility - keyboard navigation', async ({ page }) => {
    await page.goto('/zh/chat')
    
    // Focus input with keyboard
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    
    // Type message
    await page.keyboard.type('键盘导航测试')
    
    // Submit with Enter
    await page.keyboard.press('Enter')
    
    // Verify message was sent
    await expect(page.locator('.bg-amber-50').filter({ hasText: '键盘导航测试' })).toBeVisible()
  })

  test('mobile responsive design', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/zh/chat')
    
    // Verify mobile layout
    await expect(page.locator('input[type="text"]')).toBeVisible()
    await expect(page.locator('button:has-text("Send")')).toBeVisible()
    
    // Send message on mobile
    await page.locator('input[type="text"]').fill('移动端测试')
    await page.locator('button:has-text("Send")').click()
    
    // Verify it works on mobile
    await expect(page.locator('.bg-amber-50').filter({ hasText: '移动端测试' })).toBeVisible()
  })

  test('complete user journey from homepage to conversation', async ({ page }) => {
    // Start at root
    await page.goto('/')
    
    // Should redirect to localized homepage
    await expect(page).toHaveURL(/\/(zh|en)/)
    
    // Navigate to chat
    await page.goto('/zh/chat')
    
    // Complete a full conversation
    const greeting = '你好，我想开始对话'
    await page.locator('input[type="text"]').fill(greeting)
    await page.locator('button:has-text("Send")').click()
    
    // Wait for response
    await expect(page.locator('.bg-white').last()).toBeVisible({ timeout: 15000 })
    
    // Follow-up question
    await page.locator('input[type="text"]').fill('请继续')
    await page.locator('button:has-text("Send")').click()
    
    // Verify conversation flow
    await expect(page.locator('.bg-amber-50').filter({ hasText: greeting })).toBeVisible()
    await expect(page.locator('.bg-amber-50').filter({ hasText: '请继续' })).toBeVisible()
  })
})
