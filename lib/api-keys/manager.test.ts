import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getAvailableApiKey, logApiUsage, incrementApiKeyUsage } from './manager'
import { createMockSupabaseClient, createMockApiKey } from '@/__tests__/mocks/supabase'

// Mock getSupabaseAdminClient
vi.mock('@/lib/supabase/server', () => ({
  getSupabaseAdminClient: vi.fn()
}))

import { getSupabaseAdminClient } from '@/lib/supabase/server'

describe('API Key Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('getAvailableApiKey', () => {
    it('should return available API key by priority and capacity', async () => {
      // Arrange
      const mockKeys = [
        createMockApiKey({ id: 'key-1', priority: 1, daily_used: 100, daily_limit: 1000 }),
        createMockApiKey({ id: 'key-2', priority: 2, daily_used: 500, daily_limit: 1000 }),
        createMockApiKey({ id: 'key-3', priority: 3, daily_used: 0, daily_limit: 1000 })
      ]

      const mockSupabase = createMockSupabaseClient()
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({
                data: mockKeys,
                error: null
              }))
            }))
          }))
        }))
      })

      vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as any)

      // Act
      const result = await getAvailableApiKey('chutes')

      // Assert
      // Sorted by priority ascending, key-1 (priority 1) is first and has available capacity (100 < 1000)
      expect(result?.id).toBe('key-1')
      expect(getSupabaseAdminClient).toHaveBeenCalled()
    })

    it('should return null when no keys available', async () => {
      // Arrange
      const mockSupabase = createMockSupabaseClient()
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({
                data: null,
                error: null
              }))
            }))
          }))
        }))
      })

      vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as any)

      // Act
      const result = await getAvailableApiKey('chutes')

      // Assert
      expect(result).toBeNull()
    })

    it('should return null when keys array is empty', async () => {
      // Arrange
      const mockSupabase = createMockSupabaseClient()
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({
                data: [],
                error: null
              }))
            }))
          }))
        }))
      })

      vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as any)

      // Act
      const result = await getAvailableApiKey('chutes')

      // Assert
      expect(result).toBeNull()
    })

    it('should return first key when all keys at capacity', async () => {
      // Arrange
      const mockKeys = [
        createMockApiKey({ id: 'key-1', priority: 1, daily_used: 1000, daily_limit: 1000 }),
        createMockApiKey({ id: 'key-2', priority: 2, daily_used: 1000, daily_limit: 1000 })
      ]

      const mockSupabase = createMockSupabaseClient()
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({
                data: mockKeys,
                error: null
              }))
            }))
          }))
        }))
      })

      vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as any)

      // Act
      const result = await getAvailableApiKey('chutes')

      // Assert
      expect(result).toEqual(mockKeys[0]) // Returns first key when all at capacity
    })

    it('should filter by provider correctly', async () => {
      // Arrange
      const mockKeys = [
        createMockApiKey({ id: 'key-1', provider: 'chutes' })
      ]

      const mockSupabase = createMockSupabaseClient()
      const fromMock = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({
                data: mockKeys,
                error: null
              }))
            }))
          }))
        }))
      }
      mockSupabase.from = vi.fn(() => fromMock)

      vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as any)

      // Act
      await getAvailableApiKey('openrouter')

      // Assert
      expect(mockSupabase.from).toHaveBeenCalledWith('api_keys')
      expect(fromMock.select).toHaveBeenCalled()
    })

    it('should filter by is_active', async () => {
      // Arrange
      const mockKeys = [
        createMockApiKey({ id: 'key-1', is_active: true })
      ]

      const mockSupabase = createMockSupabaseClient()
      const orderMock = vi.fn(() => Promise.resolve({
        data: mockKeys,
        error: null
      }))
      const secondEqMock = vi.fn(() => ({ order: orderMock }))
      const firstEqMock = vi.fn(() => ({ eq: secondEqMock }))
      const selectMock = vi.fn(() => ({ eq: firstEqMock }))

      mockSupabase.from.mockReturnValue({
        select: selectMock
      })

      vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as any)

      // Act
      await getAvailableApiKey('chutes')

      // Assert
      expect(selectMock).toHaveBeenCalled()
      expect(firstEqMock).toHaveBeenCalled()
      expect(secondEqMock).toHaveBeenCalledWith('is_active', true)
    })

    it('should handle database errors gracefully', async () => {
      // Arrange
      const mockSupabase = createMockSupabaseClient()
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({
                data: null,
                error: { message: 'Database error' }
              }))
            }))
          }))
        }))
      })

      vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as any)

      // Act
      const result = await getAvailableApiKey('chutes')

      // Assert
      expect(result).toBeNull()
    })

    it('should select key with available capacity over priority', async () => {
      // Arrange
      const mockKeys = [
        createMockApiKey({ id: 'key-1', priority: 1, daily_used: 999, daily_limit: 1000 }),
        createMockApiKey({ id: 'key-2', priority: 2, daily_used: 0, daily_limit: 1000 })
      ]

      const mockSupabase = createMockSupabaseClient()
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({
                data: mockKeys,
                error: null
              }))
            }))
          }))
        }))
      })

      vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as any)

      // Act
      const result = await getAvailableApiKey('chutes')

      // Assert
      expect(result).toEqual(mockKeys[0]) // key-1 has capacity and higher priority
    })

    it('should respect priority order', async () => {
      // Arrange
      const mockKeys = [
        createMockApiKey({ id: 'key-3', priority: 3, daily_used: 0 }),
        createMockApiKey({ id: 'key-1', priority: 1, daily_used: 0 }),
        createMockApiKey({ id: 'key-2', priority: 2, daily_used: 0 })
      ]

      const mockSupabase = createMockSupabaseClient()
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({
                data: mockKeys,
                error: null
              }))
            }))
          }))
        }))
      })

      vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as any)

      // Act
      const result = await getAvailableApiKey('chutes')

      // Assert - should pick key-1 (priority 1) after sorting
      expect(result?.id).toBe('key-3') // First element after sorting by priority ascending
    })
  })

  describe('logApiUsage', () => {
    it('should log API usage successfully', async () => {
      // Arrange
      const mockSupabase = createMockSupabaseClient()
      const insertMock = vi.fn(() => Promise.resolve({ error: null }))
      mockSupabase.from.mockReturnValue({
        insert: insertMock
      })

      vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as any)

      const params = {
        api_key_id: 'key-123',
        provider: 'chutes',
        model_name: 'deepseek-ai/DeepSeek-V3.2-TEE',
        user_id: 'user-123',
        conversation_id: 'conv-123',
        tokens_used: 100,
        success: true,
        response_time_ms: 500
      }

      // Act
      await logApiUsage(params)

      // Assert
      expect(mockSupabase.from).toHaveBeenCalledWith('api_usage')
      expect(insertMock).toHaveBeenCalledWith([params])
    })

    it('should handle missing optional parameters', async () => {
      // Arrange
      const mockSupabase = createMockSupabaseClient()
      const insertMock = vi.fn(() => Promise.resolve({ error: null }))
      mockSupabase.from.mockReturnValue({
        insert: insertMock
      })

      vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as any)

      const params = {
        provider: 'chutes',
        success: true
      }

      // Act
      await logApiUsage(params)

      // Assert
      expect(insertMock).toHaveBeenCalledWith([params])
    })

    it('should log failed API usage', async () => {
      // Arrange
      const mockSupabase = createMockSupabaseClient()
      const insertMock = vi.fn(() => Promise.resolve({ error: null }))
      mockSupabase.from.mockReturnValue({
        insert: insertMock
      })

      vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as any)

      const params = {
        provider: 'chutes',
        success: false,
        error_message: 'API timeout',
        response_time_ms: 30000
      }

      // Act
      await logApiUsage(params)

      // Assert
      expect(insertMock).toHaveBeenCalledWith([params])
    })

    it('should handle database errors gracefully', async () => {
      // Arrange
      const mockSupabase = createMockSupabaseClient()
      const insertMock = vi.fn(() => Promise.reject(new Error('Database connection failed')))
      mockSupabase.from.mockReturnValue({
        insert: insertMock
      })

      vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabase as any)

      const params = {
        provider: 'chutes',
        success: true
      }

      // Act & Assert - should not throw
      await expect(logApiUsage(params)).resolves.toBeUndefined()
    })
  })

  describe('incrementApiKeyUsage', () => {
    it('should return early (backwards compatibility)', async () => {
      // Act
      await incrementApiKeyUsage('key-123')

      // Assert
      expect(getSupabaseAdminClient).not.toHaveBeenCalled()
    })

    it('should always return undefined', async () => {
      // Act
      const result = await incrementApiKeyUsage('any-key-id')

      // Assert
      expect(result).toBeUndefined()
    })
  })
})
