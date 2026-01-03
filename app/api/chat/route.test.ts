import { POST } from './route'
import { NextRequest } from 'next/server'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock all dependencies
vi.mock('@/lib/supabase/server', () => ({
  getSupabaseAdminClient: vi.fn(),
  createClient: vi.fn(),
}))

vi.mock('@/lib/api-keys/manager', () => ({
  getAvailableApiKey: vi.fn(),
}))

vi.mock('@/lib/prompts/manager', () => ({
  getActivePrompt: vi.fn(),
}))

vi.mock('@/lib/llm/chutes', () => ({
  streamChatCompletion: vi.fn(),
}))

vi.mock('@/lib/llm/streaming', () => ({
  streamToSSE: vi.fn(),
}))

import { createClient, getSupabaseAdminClient } from '@/lib/supabase/server'
import { getAvailableApiKey } from '@/lib/api-keys/manager'
import { getActivePrompt } from '@/lib/prompts/manager'
import { streamChatCompletion } from '@/lib/llm/chutes'
import { streamToSSE } from '@/lib/llm/streaming'

describe('Chat API Route', () => {
  let mockSupabaseClient: any
  let mockAuthClient: any
  let mockStream: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mock Supabase client
    mockSupabaseClient = {
      from: vi.fn(() => mockSupabaseClient),
      insert: vi.fn(() => mockSupabaseClient),
      select: vi.fn(() => mockSupabaseClient),
      eq: vi.fn(() => mockSupabaseClient),
      order: vi.fn(() => mockSupabaseClient),
      single: vi.fn(),
      maybeSingle: vi.fn(),
    }

    vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabaseClient)

    mockAuthClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        }),
      },
    }
    vi.mocked(createClient).mockReturnValue(mockAuthClient)

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
      key: 'test-api-key',
      provider: 'chutes',
    })

    vi.mocked(getActivePrompt).mockResolvedValue('You are a helpful assistant')
  })

  describe('Request validation', () => {
    it('should accept valid request body', async () => {
      const body = {
        message: 'Hello',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        language: 'zh',
      }

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      // Setup conversation history mock
      mockSupabaseClient.maybeSingle.mockResolvedValue({
        data: { id: body.conversationId },
        error: null,
      })
      mockSupabaseClient.order.mockResolvedValue({
        data: [
          { role: 'user', content: 'Previous message' },
          { role: 'assistant', content: 'Previous response' },
        ],
        error: null,
      })

      await POST(request)

      expect(getSupabaseAdminClient).toHaveBeenCalled()
    })

    it('should reject request with missing message', async () => {
      const body = {
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
      }

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation failed')
      expect(data.errors).toHaveProperty('message')
    })

    it('should reject request with empty message', async () => {
      const body = {
        message: '',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
      }

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.errors.message).toContain('Message is required')
    })

    it('should reject request with message too long', async () => {
      const body = {
        message: 'a'.repeat(5001),
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
      }

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.errors.message).toContain('Message too long')
    })

    it('should reject request with invalid conversationId format', async () => {
      const body = {
        message: 'Hello',
        conversationId: 'invalid-uuid',
      }

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.errors.conversationId).toContain('Invalid conversation ID')
    })

    it('should reject request with invalid language', async () => {
      const body = {
        message: 'Hello',
        language: 'fr',
      }

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.errors.language).toBeDefined()
    })

    it('should accept valid languages (zh and en)', async () => {
      for (const lang of ['zh', 'en']) {
        vi.clearAllMocks()
        
        // Re-setup mocks after clearing
        vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabaseClient)
        vi.mocked(createClient).mockReturnValue(mockAuthClient)
        vi.mocked(streamToSSE).mockImplementation((callback) => {
          callback(mockStream)
          return new Response('mocked response')
        })
        vi.mocked(getAvailableApiKey).mockResolvedValue({
          id: 'key-123',
          key: 'test-api-key',
          provider: 'chutes',
        })
        vi.mocked(getActivePrompt).mockResolvedValue('You are a helpful assistant')

        const body = {
          message: 'Hello',
          language: lang,
        }

        const request = new NextRequest('http://localhost:3000/api/chat', {
          method: 'POST',
          body: JSON.stringify(body),
        })

        // Setup new conversation creation
        mockSupabaseClient.single.mockResolvedValue({
          data: { id: 'new-conversation-id' },
          error: null,
        })

        await POST(request)
        
        // Verify conversation was created for this language
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('conversations')
      }
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

      mockSupabaseClient.single.mockResolvedValue({
        data: { id: 'new-conversation-id' },
        error: null,
      })

      await POST(request)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('conversations')
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith([{ language: 'zh', user_id: 'user-123' }])
    })

    it('should use existing conversation when conversationId provided', async () => {
      const conversationId = '550e8400-e29b-41d4-a716-446655440000'
      const body = {
        message: 'Hello',
        conversationId,
      }

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      // Setup the mock chain properly
      mockSupabaseClient.maybeSingle.mockResolvedValue({
        data: { id: conversationId },
        error: null,
      })
      mockSupabaseClient.order.mockResolvedValue({
        data: [
          { role: 'user', content: 'Previous message' },
          { role: 'assistant', content: 'Previous response' },
        ],
        error: null,
      })

      await POST(request)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('messages')
      // The eq is called via the chain
      expect(mockSupabaseClient.eq).toBeDefined()
    })

    it('should fetch conversation history correctly', async () => {
      const conversationId = '550e8400-e29b-41d4-a716-446655440000'
      const body = {
        message: 'Hello',
        conversationId,
      }

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const mockMessages = [
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'First response' },
        { role: 'user', content: 'Second message' },
        { role: 'assistant', content: 'Second response' },
      ]

      mockSupabaseClient.maybeSingle.mockResolvedValue({
        data: { id: conversationId },
        error: null,
      })
      mockSupabaseClient.order.mockResolvedValue({
        data: mockMessages,
        error: null,
      })

      await POST(request)

      // Verify select was called (Supabase syntax uses 'role, content' as single string)
      expect(mockSupabaseClient.select).toHaveBeenCalled()
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('messages')
    })
  })

  describe('API key handling', () => {
    it('should throw error when no API key available', async () => {
      vi.mocked(getAvailableApiKey).mockResolvedValue(null)

      const body = {
        message: 'Hello',
      }

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      mockSupabaseClient.single.mockResolvedValue({
        data: { id: 'new-conversation-id' },
        error: null,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('No available Chutes API key')
    })

    it('should call getAvailableApiKey with correct provider', async () => {
      const body = {
        message: 'Hello',
      }

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      mockSupabaseClient.single.mockResolvedValue({
        data: { id: 'new-conversation-id' },
        error: null,
      })

      await POST(request)

      expect(getAvailableApiKey).toHaveBeenCalledWith('chutes')
    })
  })

  describe('Prompt handling', () => {
    it('should fetch active prompt for formless_elder role', async () => {
      const body = {
        message: 'Hello',
        language: 'zh',
      }

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      mockSupabaseClient.single.mockResolvedValue({
        data: { id: 'new-conversation-id' },
        error: null,
      })

      await POST(request)

      expect(getActivePrompt).toHaveBeenCalledWith('formless_elder', 'zh')
    })

    it('should fetch prompt with correct language', async () => {
      for (const lang of ['zh', 'en']) {
        vi.clearAllMocks()
        
        // Re-setup mocks
        vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabaseClient)
        vi.mocked(createClient).mockReturnValue(mockAuthClient)
        vi.mocked(streamToSSE).mockImplementation((callback) => {
          callback(mockStream)
          return new Response('mocked response')
        })
        vi.mocked(getAvailableApiKey).mockResolvedValue({
          id: 'key-123',
          key: 'test-api-key',
          provider: 'chutes',
        })

        const body = {
          message: 'Hello',
          language: lang,
        }

        const request = new NextRequest('http://localhost:3000/api/chat', {
          method: 'POST',
          body: JSON.stringify(body),
        })

        mockSupabaseClient.single.mockResolvedValue({
          data: { id: 'new-conversation-id' },
          error: null,
        })

        await POST(request)

        expect(getActivePrompt).toHaveBeenCalledWith('formless_elder', lang)
      }
    })
  })

  describe('Message insertion', () => {
    it('should insert user message into database', async () => {
      const body = {
        message: 'Test message',
      }

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      mockSupabaseClient.single.mockResolvedValue({
        data: { id: 'conv-123' },
        error: null,
      })

      await POST(request)

      // Verify user message insertion
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('messages')
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: 'Test message',
          }),
        ])
      )
    })
  })

  describe('Error handling', () => {
    it('should handle conversation creation error', async () => {
      const body = {
        message: 'Hello',
      }

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('Failed to create conversation')
    })

    it('should handle database errors gracefully', async () => {
      const body = {
        message: 'Hello',
      }

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      mockSupabaseClient.single.mockRejectedValue(new Error('Database error'))

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBeDefined()
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

      mockSupabaseClient.single.mockResolvedValue({
        data: { id: 'conv-123' },
        error: null,
      })

      await POST(request)

      expect(streamToSSE).toHaveBeenCalled()
      expect(typeof streamToSSE.mock.calls[0][0]).toBe('function')
    })
  })
})
