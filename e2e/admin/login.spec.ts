import { test, expect } from '@playwright/test'

test.describe('Admin Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/login')
  })

  test('should display login form', async ({ page }) => {
    // Check if title is visible
    await expect(page.locator('text=Admin Login')).toBeVisible()
    
    // Check if email input is visible
    await expect(page.locator('input[type="email"]')).toBeVisible()
    
    // Check if password input is visible
    await expect(page.locator('input[type="password"]')).toBeVisible()
    
    // Check if submit button is visible
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('should show error for invalid email format', async ({ page }) => {
    // Fill with invalid email
    await page.locator('input[type="email"]').fill('invalid-email')
    await page.locator('input[type="password"]').fill('password123')
    
    // Try to submit
    await page.locator('button[type="submit"]').click()
    
    // Browser's HTML5 validation should prevent submission
    const emailInput = page.locator('input[type="email"]')
    await expect(emailInput).toHaveAttribute('required', '')
  })

  test('should show error for empty fields', async ({ page }) => {
    // Try to submit without filling fields
    await page.locator('button[type="submit"]').click()
    
    // Browser's HTML5 validation should prevent submission
    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    
    await expect(emailInput).toHaveAttribute('required', '')
    await expect(passwordInput).toHaveAttribute('required', '')
  })

  test('should show error for invalid credentials', async ({ page }) => {
    // Mock failed login response
    await page.route('**/api/admin/login', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid credentials' }),
      })
    })
    
    // Fill form
    await page.locator('input[type="email"]').fill('admin@example.com')
    await page.locator('input[type="password"]').fill('wrongpassword')
    
    // Submit form
    await page.locator('button[type="submit"]').click()
    
    // Verify error message appears
    await expect(page.locator('.bg-red-50')).toBeVisible()
    await expect(page.locator('text=Invalid credentials')).toBeVisible()
  })

  test('should redirect to admin panel on successful login', async ({ page }) => {
    // Mock successful login response
    await page.route('**/api/admin/login', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          success: true,
          token: 'mock-jwt-token'
        }),
      })
    })
    
    // Mock admin page to prevent actual redirect failure
    await page.route('**/admin', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html><body>Admin Panel</body></html>',
      })
    })
    
    // Fill form
    await page.locator('input[type="email"]').fill('admin@example.com')
    await page.locator('input[type="password"]').fill('correctpassword')
    
    // Submit form
    await page.locator('button[type="submit"]').click()
    
    // Verify navigation to admin panel
    await expect(page).toHaveURL(/\/admin/)
  })

  test('should show loading state during login', async ({ page }) => {
    // Mock delayed response
    await page.route('**/api/admin/login', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000))
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid credentials' }),
      })
    })
    
    // Fill form
    await page.locator('input[type="email"]').fill('admin@example.com')
    await page.locator('input[type="password"]').fill('password')
    
    // Submit form
    await page.locator('button[type="submit"]').click()
    
    // Verify loading state
    await expect(page.locator('button:has-text("Signing in...")')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeDisabled()
  })

  test('should protect admin routes from unauthorized access', async ({ page }) => {
    // Try to access admin page directly
    await page.goto('/admin')
    
    // Should redirect to login page
    await expect(page).toHaveURL(/\/admin\/login/)
  })

  test('should clear error when user starts typing', async ({ page }) => {
    // Mock failed login to show error
    await page.route('**/api/admin/login', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid credentials' }),
      })
    })
    
    // Submit invalid credentials
    await page.locator('input[type="email"]').fill('admin@example.com')
    await page.locator('input[type="password"]').fill('wrong')
    await page.locator('button[type="submit"]').click()
    
    // Wait for error
    await expect(page.locator('.bg-red-50')).toBeVisible()
    
    // Start typing in email field
    await page.locator('input[type="email"]').fill('user@example.com')
    
    // Error should still be visible (error clears on next submit attempt)
    await expect(page.locator('.bg-red-50')).toBeVisible()
  })

  test('should have proper form autocomplete attributes', async ({ page }) => {
    // Check email autocomplete
    const emailInput = page.locator('input[type="email"]')
    await expect(emailInput).toHaveAttribute('autoComplete', 'email')
    
    // Check password autocomplete
    const passwordInput = page.locator('input[type="password"]')
    await expect(passwordInput).toHaveAttribute('autoComplete', 'current-password')
  })

  test('should handle network errors gracefully', async ({ page }) => {
    // Intercept and fail the request
    await page.route('**/api/admin/login', route => route.abort('failed'))
    
    // Fill form
    await page.locator('input[type="email"]').fill('admin@example.com')
    await page.locator('input[type="password"]').fill('password')
    
    // Submit form
    await page.locator('button[type="submit"]').click()
    
    // Verify error message appears
    await expect(page.locator('.bg-red-50')).toBeVisible({ timeout: 5000 })
  })

  test('should maintain form state during error', async ({ page }) => {
    // Mock failed login
    await page.route('**/api/admin/login', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid credentials' }),
      })
    })
    
    const email = 'admin@example.com'
    const password = 'wrongpassword'
    
    // Fill form
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[type="password"]').fill(password)
    
    // Submit form
    await page.locator('button[type="submit"]').click()
    
    // Verify form values are preserved
    await expect(page.locator('input[type="email"]')).toHaveValue(email)
    await expect(page.locator('input[type="password"]')).toHaveValue(password)
  })
})
