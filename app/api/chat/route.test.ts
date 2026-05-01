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

vi.mock('@/lib/llm/client', () => ({
  streamChatCompletionWithProvider: vi.fn(),
}))

vi.mock('@/lib/llm/streaming', () => ({
  streamToSSE: vi.fn(),
}))

process.env.NEXT_PUBLIC_CONVEX_URL = 'https://mock.convex.cloud'
process.env.CONVEX_ADMIN_TOKEN = 'admin-token'

import { auth, currentUser } from '@clerk/nextjs/server'
import { getConvexClientWithAuth, getConvexAdminClient } from '@/lib/convex'
import { streamToSSE } from '@/lib/llm/streaming'
import { streamChatCompletionWithProvider } from '@/lib/llm/client'

const defaultInsights = {
  personality: null as string | null,
  interests: [] as string[],
  concerns: [] as string[],
}

function defaultPrep(overrides?: {
  memorySnapshot?: { quotes: unknown[]; insights: typeof defaultInsights }
  conversationHistory?: Array<{ role: string; content: string }>
}) {
  return {
    convexUserId: 'user-123',
    activeConversationId: 'conv-123',
    conversationHistory: overrides?.conversationHistory ?? [],
    memorySnapshot: overrides?.memorySnapshot ?? {
      quotes: [] as unknown[],
      insights: defaultInsights,
    },
  }
}

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

    vi.mocked(streamChatCompletionWithProvider).mockImplementation(
      async (_provider: string, _apiKey: string, options: any) => {
        options.onChunk?.('Hello')
        await options.onComplete?.('Hello')
      }
    )

    mockUserClient.mutation.mockImplementation(async (_ref: any, args?: any) => {
      if (args?.titleSeed !== undefined) {
        return defaultPrep()
      }
      return null
    })

    mockUserClient.query.mockImplementation(async (_ref: any, args?: any) => {
      if (args?.id) return { _id: args.id }
      if (args?.conversationId && args?.limit) {
        return { quotes: [], insights: { personality: null, interests: [], concerns: [] } }
      }
      if (args?.conversationId) return []
      return []
    })

    mockAdminClient.query.mockImplementation((async (_ref: any, args?: any) => {
      if (args?.role !== undefined) {
        return { content: 'System prompt', _id: 'p1', language: 'zh' }
      }
      if (args?.provider !== undefined) {
        return { _id: 'key-123', api_key: 'test-key', model_name: 'model', provider: 'openrouter' }
      }
      return null
    }) as any)

    mockAdminClient.mutation.mockResolvedValue(undefined)
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

  it('returns 500 when no API key is configured', async () => {
    mockAdminClient.query.mockImplementation((async (_ref: any, args?: any) => {
      if (args?.role !== undefined) {
        return { content: 'System prompt', _id: 'p1', language: 'zh' }
      }
      return null
    }) as any)

    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello', language: 'zh' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(500)

    const data = await response.json()
    expect(data.code).toBe('CONFIG_ERROR')
    expect(data.error).toBe('OpenRouter API key is not configured')
  })

  it('creates a new conversation when conversationId is not provided', async () => {
    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello', language: 'zh' }),
    })

    await POST(request)

    expect(mockUserClient.mutation).toHaveBeenCalled()
    expect(mockAdminClient.query).toHaveBeenCalled()
    expect(streamToSSE).toHaveBeenCalled()
  })

  it('injects memory context when available', async () => {
    mockUserClient.mutation.mockImplementation(async (_ref: any, args?: any) => {
      if (args?.titleSeed !== undefined) {
        return defaultPrep({
          memorySnapshot: {
            quotes: [{ quote: 'Remember this quote', context: 'Context' }],
            insights: {
              personality: 'calm',
              interests: ['meditation'],
              concerns: ['sleep'],
            },
          },
        })
      }
      return null
    })

    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello', language: 'zh' }),
    })

    await POST(request)

    const [, , options] = vi.mocked(streamChatCompletionWithProvider).mock.calls[0]
    const memoryMessage = options.messages.find((item: any) =>
      item.content.includes('User memory context')
    )

    expect(memoryMessage).toBeDefined()
    if (!memoryMessage) throw new Error('Expected memory context message')
    expect(memoryMessage.content).toContain('Remember this quote')
    expect(memoryMessage.content).toContain('meditation')
  })

  it('skips memory context when empty', async () => {
    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello', language: 'zh' }),
    })

    await POST(request)

    const [, , options] = vi.mocked(streamChatCompletionWithProvider).mock.calls[0]
    const memoryMessages = options.messages.filter((item: any) =>
      item.content.includes('User memory context')
    )

    expect(memoryMessages).toHaveLength(0)
  })

  it('loads conversation history when conversationId is provided', async () => {
    mockUserClient.mutation.mockImplementation(async (_ref: any, args?: any) => {
      if (args?.titleSeed !== undefined) {
        return defaultPrep({
          conversationHistory: [
            { role: 'user', content: 'Hi' },
            { role: 'assistant', content: 'Hey' },
          ],
        })
      }
      return null
    })

    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello', conversationId: 'conv-123', language: 'zh' }),
    })

    await POST(request)

    expect(mockUserClient.mutation).toHaveBeenCalled()
    const [, , options] = vi.mocked(streamChatCompletionWithProvider).mock.calls[0]
    const historyUser = options.messages.filter((m: any) => m.content === 'Hi')
    expect(historyUser.length).toBeGreaterThan(0)
  })
})
