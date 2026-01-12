import { POST } from './route'
import { NextRequest } from 'next/server'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock Clerk auth
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn().mockResolvedValue({ userId: 'user_clerk_123' }),
  currentUser: vi.fn().mockResolvedValue({
    id: 'user_clerk_123',
    emailAddresses: [{ emailAddress: 'test@example.com' }],
    firstName: 'Test',
    lastName: 'User'
  }),
}))

// Mock Convex client
vi.mock('@/lib/convex', () => ({
  getConvexClient: vi.fn(),
}))

vi.mock('@/lib/api-keys/manager', () => ({
  getAvailableApiKey: vi.fn(),
}))

vi.mock('@/lib/llm/chutes', () => ({
  streamChatCompletion: vi.fn(),
}))

vi.mock('@/lib/llm/streaming', () => ({
  streamToSSE: vi.fn(),
}))

// Mock env
process.env.NEXT_PUBLIC_CONVEX_URL = 'https://mock.convex.cloud'

import { auth, currentUser } from '@clerk/nextjs/server'
import { getConvexClient } from '@/lib/convex'
import { getAvailableApiKey } from '@/lib/api-keys/manager'
import { streamToSSE } from '@/lib/llm/streaming'
import { api } from '@/convex/_generated/api'

describe('Chat API Route', () => {
  let mockConvex: any
  let mockStream: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mock Convex client
    mockConvex = {
      mutation: vi.fn(),
      query: vi.fn(),
    }

    vi.mocked(getConvexClient).mockReturnValue(mockConvex)

    // Setup mock stream
    mockStream = {
      sendEvent: vi.fn(),
      sendError: vi.fn(),
      close: vi.fn(),
    }

    vi.mocked(streamToSSE).mockImplementation((callback) => {
      callback(mockStream)
      return new Response('mocked response')
    })

    // Setup default mock responses
    vi.mocked(getAvailableApiKey).mockResolvedValue({
      id: 'key-123',
      api_key: 'test-api-key',
      provider: 'chutes',
    })

    mockConvex.mutation.mockImplementation(async (apiRef: any) => {
      if (apiRef === api.users.ensure) return 'user-123'
      if (apiRef === api.conversations.createInternal) return 'conv-123'
      if (apiRef === api.api_keys.getAvailable) return { _id: 'key-123', api_key: 'test-key', provider: 'chutes' }
      if (apiRef === api.messages.insert) return 'msg-123'
      if (apiRef === api.api_usage.log) return null
      if (apiRef === api.api_keys.incrementUsage) return null
      return {}
    })

    mockConvex.query.mockImplementation(async (apiRef: any) => {
      if (apiRef === api.prompts.getActive) return { content: 'System prompt' }
      if (apiRef === api.conversations.get) return { user_id: 'user-123' }
      if (apiRef === api.messages.list) return []
      return null
    })
  })

  describe('Request validation', () => {
    it('should accept valid request body', async () => {
      const body = {
        message: 'Hello',
        conversationId: 'conv-123',
        language: 'zh',
      }

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      await POST(request)

      expect(getConvexClient).toHaveBeenCalled()
      expect(mockConvex.mutation).toHaveBeenCalledWith(api.users.ensure, expect.any(Object))
    })

    it('should reject request with missing message', async () => {
      const body = {
        conversationId: 'conv-123',
      }

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('数据验证失败')
    })
  })

  describe('Conversation handling', () => {
    it('should create new conversation when conversationId not provided', async () => {
      const body = {
        message: 'Hello',
        language: 'zh',
      }

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      await POST(request)

      expect(mockConvex.mutation).toHaveBeenCalledWith(api.conversations.createInternal, expect.objectContaining({
        userId: 'user-123',
        language: 'zh'
      }))
    })

    it('should use existing conversation when conversationId provided', async () => {
      const conversationId = 'conv-123'
      const body = {
        message: 'Hello',
        conversationId,
      }

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      await POST(request)

      expect(mockConvex.query).toHaveBeenCalledWith(api.conversations.get, { id: conversationId })
      expect(mockConvex.query).toHaveBeenCalledWith(api.messages.list, { conversationId })
    })
  })

  describe('API key handling', () => {
    it('should return 500 when no API key available', async () => {
      mockConvex.mutation.mockImplementation(async (apiRef: any) => {
        if (apiRef === api.api_keys.getAvailable) return null
        if (apiRef === api.users.ensure) return 'user-123'
        if (apiRef === api.conversations.createInternal) return 'conv-123'
        return {}
      })

      const body = {
        message: 'Hello',
      }

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('服务暂时不可用')
    })
  })

  describe('SSE streaming', () => {
    it('should call streamToSSE with stream callback', async () => {
      const body = {
        message: 'Hello',
      }

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      await POST(request)

      expect(streamToSSE).toHaveBeenCalled()
      expect(typeof vi.mocked(streamToSSE).mock.calls[0][0]).toBe('function')
    })
  })
})
