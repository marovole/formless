import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAvailableApiKey, logApiUsage, incrementApiKeyUsage } from './manager'

// Mock Convex client
vi.mock('@/lib/convex', () => ({
  getConvexClient: vi.fn(),
}))

import { getConvexClient } from '@/lib/convex'
import { api } from '@/convex/_generated/api'

describe('API Key Manager', () => {
  let mockConvex: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockConvex = {
      mutation: vi.fn(),
      query: vi.fn(),
    }
    vi.mocked(getConvexClient).mockReturnValue(mockConvex)
  })

  describe('getAvailableApiKey', () => {
    it('should return available API key', async () => {
      // Arrange
      const mockKey = { _id: 'key-1', api_key: 'test-key', provider: 'chutes' }
      mockConvex.mutation.mockResolvedValue(mockKey)

      // Act
      const result = await getAvailableApiKey('chutes')

      // Assert
      expect(result).not.toBeNull()
      expect(result?.id).toBe('key-1')
      expect(mockConvex.mutation).toHaveBeenCalledWith(api.api_keys.getAvailable, { provider: 'chutes' })
    })

    it('should return null when no keys available', async () => {
      // Arrange
      mockConvex.mutation.mockResolvedValue(null)

      // Act
      const result = await getAvailableApiKey('chutes')

      // Assert
      expect(result).toBeNull()
    })

    it('should handle errors gracefully', async () => {
      // Arrange
      mockConvex.mutation.mockRejectedValue(new Error('Convex error'))

      // Act
      const result = await getAvailableApiKey('chutes')

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('logApiUsage', () => {
    it('should log API usage successfully', async () => {
      // Arrange
      const params = {
        api_key_id: 'key-123',
        provider: 'chutes',
        user_id: 'user-123',
        tokens_used: 100,
        success: true
      }

      // Act
      await logApiUsage(params)

      // Assert
      expect(mockConvex.mutation).toHaveBeenCalledWith(api.api_usage.log, expect.objectContaining({
        apiKeyId: 'key-123',
        provider: 'chutes'
      }))
    })
  })

  describe('incrementApiKeyUsage', () => {
    it('should call increment mutation', async () => {
      // Act
      await incrementApiKeyUsage('key-123', 50)

      // Assert
      expect(mockConvex.mutation).toHaveBeenCalledWith(api.api_keys.incrementUsage, {
        keyId: 'key-123',
        tokenCount: 50
      })
    })
  })
})
