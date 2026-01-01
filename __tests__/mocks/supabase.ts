import { vi } from 'vitest'

export function createMockSupabaseClient() {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({
                data: [],
                error: null
              }))
            }))
          })),
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({
              data: [],
              error: null
            }))
          }))
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: { id: 'test-id' },
              error: null
            }))
          }))
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({
            data: null,
            error: null
          }))
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({
            data: null,
            error: null
          }))
        }))
      }))
    })),
    auth: {
      getSession: vi.fn(() => Promise.resolve({
        data: { session: null },
        error: null
      }))
    }
  }
}

export function createMockConversation(overrides = {}) {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    user_id: 'user-123',
    language: 'zh',
    message_count: 0,
    created_at: new Date().toISOString(),
    ...overrides
  }
}

export function createMockMessage(overrides = {}) {
  return {
    id: 'msg-123',
    conversation_id: 'conv-123',
    role: 'user',
    content: 'Test message',
    tokens: 10,
    created_at: new Date().toISOString(),
    ...overrides
  }
}

export function createMockApiKey(overrides = {}) {
  return {
    id: 'key-123',
    provider: 'chutes',
    api_key: 'test-key',
    model_name: 'deepseek-ai/DeepSeek-V3.2-TEE',
    daily_limit: 1000,
    daily_used: 0,
    priority: 1,
    is_active: true,
    created_at: new Date().toISOString(),
    ...overrides
  }
}
