import { POST } from './route'
import { NextRequest } from 'next/server'
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}))

vi.mock('@/lib/convex', () => ({
  getConvexClientWithAuth: vi.fn(),
  getConvexAdminClient: vi.fn(),
}))

vi.mock('@/lib/llm/chutes', () => ({
  streamChatCompletion: vi.fn(),
}))

vi.mock('@/lib/llm/streaming', () => ({
  streamToSSE: vi.fn(),
}))

process.env.NEXT_PUBLIC_CONVEX_URL = 'https://mock.convex.cloud'
process.env.CONVEX_ADMIN_TOKEN = 'admin-token'

import { auth, currentUser } from '@clerk/nextjs/server'
import { getConvexClientWithAuth, getConvexAdminClient } from '@/lib/convex'
import { streamToSSE } from '@/lib/llm/streaming'
import { streamChatCompletion } from '@/lib/llm/chutes'

describe('Chat API Route', () => {
  let mockUserClient: any
  let mockAdminClient: any
  let mockStream: any

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(auth).mockResolvedValue({
      userId: 'user_clerk_123',
      getToken: vi.fn().mockResolvedValue('convex-token'),
    } as any)

    vi.mocked(currentUser).mockResolvedValue({
      fullName: 'Test User',
      imageUrl: 'https://example.com/avatar.png',
    } as any)

    mockUserClient = {
      query: vi.fn(),
      mutation: vi.fn(),
    }

    mockAdminClient = {
      query: vi.fn(),
      mutation: vi.fn(),
    }

    vi.mocked(getConvexClientWithAuth).mockReturnValue(mockUserClient)
    vi.mocked(getConvexAdminClient).mockReturnValue(mockAdminClient)

    mockStream = {
      sendEvent: vi.fn(),
      sendError: vi.fn(),
      close: vi.fn(),
    }

    vi.mocked(streamToSSE).mockImplementation((callback: any) => {
      callback(mockStream)
      return new Response('mocked response')
    })

    vi.mocked(streamChatCompletion).mockImplementation(async (_apiKey: string, options: any) => {
      options.onChunk?.('Hello')
      await options.onComplete?.('Hello')
    })

    mockUserClient.query.mockImplementation(async (_ref: any, args?: any) => {
      if (args?.id) return { _id: args.id }
      if (args?.conversationId && args?.limit) {
        return { quotes: [], insights: { personality: null, interests: [], concerns: [] } }
      }
      if (args?.conversationId) return []
      return []
    })
    mockUserClient.mutation.mockImplementation(async (_ref: any, args?: any) => {
      if (args?.preferredLanguage !== undefined) return 'user-123'
      if (args?.title !== undefined) return 'conv-123'
      return null
    })

    mockAdminClient.query.mockResolvedValue({ content: 'System prompt' })
    mockAdminClient.mutation
      .mockResolvedValueOnce({ _id: 'key-123', api_key: 'test-key', model_name: 'model' })
      .mockResolvedValue(undefined)
  })

  it('rejects request with missing message', async () => {
    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)

    const data = await response.json()
    expect(data.error).toBe('Validation failed')
  })

  it('creates a new conversation when conversationId is not provided', async () => {
    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello', language: 'zh' }),
    })

    await POST(request)

    expect(mockUserClient.mutation).toHaveBeenCalled()
    expect(mockAdminClient.mutation).toHaveBeenCalled()
    expect(streamToSSE).toHaveBeenCalled()
  })

  it('injects memory context when available', async () => {
    mockUserClient.query.mockImplementation(async (_ref: any, args?: any) => {
      if (args?.conversationId && args?.limit) {
        return {
          quotes: [{ quote: 'Remember this quote', context: 'Context' }],
          insights: {
            personality: 'calm',
            interests: ['meditation'],
            concerns: ['sleep'],
          },
        }
      }
      if (args?.conversationId) return []
      return []
    })

    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello', language: 'zh' }),
    })

    await POST(request)

    const [, options] = vi.mocked(streamChatCompletion).mock.calls[0]
    const memoryMessage = options.messages.find((item: any) =>
      item.content.includes('User memory context')
    )

    expect(memoryMessage).toBeDefined()
    if (!memoryMessage) throw new Error('Expected memory context message')
    expect(memoryMessage.content).toContain('Remember this quote')
    expect(memoryMessage.content).toContain('meditation')
  })

  it('skips memory context when empty', async () => {
    mockUserClient.query.mockImplementation(async (_ref: any, args?: any) => {
      if (args?.conversationId && args?.limit) {
        return { quotes: [], insights: { personality: null, interests: [], concerns: [] } }
      }
      if (args?.conversationId) return []
      return []
    })

    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello', language: 'zh' }),
    })

    await POST(request)

    const [, options] = vi.mocked(streamChatCompletion).mock.calls[0]
    const memoryMessages = options.messages.filter((item: any) =>
      item.content.includes('User memory context')
    )

    expect(memoryMessages).toHaveLength(0)
  })

  it('loads conversation history when conversationId is provided', async () => {
    mockUserClient.query.mockImplementation(async (_ref: any, args?: any) => {
      if (args?.id) return { _id: args.id }
      return []
    })

    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello', conversationId: 'conv-123', language: 'zh' }),
    })

    await POST(request)

    expect(mockUserClient.query).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 'conv-123' }))
    expect(mockUserClient.query).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ conversationId: 'conv-123' }))
  })
})

