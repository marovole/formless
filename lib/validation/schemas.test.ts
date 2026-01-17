import { describe, it, expect, vi } from 'vitest'
import {
  LoginSchema,
  ChatSchema,
  CreateApiKeySchema,
  UpdateApiKeySchema,
  UpdatePromptSchema,
  ValidationError,
  validateRequestBody,
} from './schemas'

describe('LoginSchema', () => {
  it('should validate valid email and password', () => {
    const result = LoginSchema.safeParse({
      email: 'user@example.com',
      password: 'password123'
    })
    expect(result.success).toBe(true)
  })

  it('should reject invalid email format', () => {
    const result = LoginSchema.safeParse({
      email: 'invalid-email',
      password: 'password123'
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = result.error.issues
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].message).toBe('Invalid email format')
    }
  })

  it('should reject short password (less than 6 characters)', () => {
    const result = LoginSchema.safeParse({
      email: 'user@example.com',
      password: '12345'
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = result.error.issues
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].message).toBe('Password must be at least 6 characters')
    }
  })

  it('should reject missing email', () => {
    const result = LoginSchema.safeParse({
      password: 'password123'
    })
    expect(result.success).toBe(false)
  })

  it('should reject missing password', () => {
    const result = LoginSchema.safeParse({
      email: 'user@example.com'
    })
    expect(result.success).toBe(false)
  })
})

describe('ChatSchema', () => {
  it('should validate valid message', () => {
    const result = ChatSchema.safeParse({
      message: 'Hello, how are you?'
    })
    expect(result.success).toBe(true)
  })

  it('should validate valid message with optional fields', () => {
    const result = ChatSchema.safeParse({
      message: 'Hello',
      conversationId: 'convex-conversation-id',
      language: 'zh'
    })
    expect(result.success).toBe(true)
  })

  it('should reject empty message', () => {
    const result = ChatSchema.safeParse({
      message: ''
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = result.error.issues
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].message).toBe('Message is required')
    }
  })

  it('should reject message over 5000 characters', () => {
    const longMessage = 'a'.repeat(5001)
    const result = ChatSchema.safeParse({
      message: longMessage
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = result.error.issues
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].message).toBe('Message too long')
    }
  })

  it('should accept message exactly 5000 characters', () => {
    const message = 'a'.repeat(5000)
    const result = ChatSchema.safeParse({
      message
    })
    expect(result.success).toBe(true)
  })

  it('should reject empty conversationId', () => {
    const result = ChatSchema.safeParse({
      message: 'Hello',
      conversationId: ''
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = result.error.issues
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].message).toBe('Invalid conversation ID')
    }
  })

  it('should reject invalid language', () => {
    const result = ChatSchema.safeParse({
      message: 'Hello',
      language: 'it'
    })
    expect(result.success).toBe(false)
  })

  it('should accept valid language values', () => {
    const zhResult = ChatSchema.safeParse({
      message: 'Hello',
      language: 'zh'
    })
    const enResult = ChatSchema.safeParse({
      message: 'Hello',
      language: 'en'
    })
    const frResult = ChatSchema.safeParse({
      message: 'Hello',
      language: 'fr'
    })
    expect(zhResult.success).toBe(true)
    expect(enResult.success).toBe(true)
    expect(frResult.success).toBe(true)
  })

  it('should accept null conversationId', () => {
    const result = ChatSchema.safeParse({
      message: 'Hello',
      conversationId: null,
      language: 'zh'
    })
    expect(result.success).toBe(true)
  })
})

describe('CreateApiKeySchema', () => {
  it('should validate valid API key creation', () => {
    const result = CreateApiKeySchema.safeParse({
      provider: 'chutes',
      api_key: 'sk-test-key'
    })
    expect(result.success).toBe(true)
  })

  it('should validate with optional fields', () => {
    const result = CreateApiKeySchema.safeParse({
      provider: 'openrouter',
      api_key: 'sk-or-key',
      model_name: 'deepseek-ai/DeepSeek-V3.2-TEE',
      daily_limit: 1000,
      priority: 1
    })
    expect(result.success).toBe(true)
  })

  it('should reject invalid provider', () => {
    const result = CreateApiKeySchema.safeParse({
      provider: 'invalid',
      api_key: 'sk-test-key'
    })
    expect(result.success).toBe(false)
  })

  it('should reject missing api_key', () => {
    const result = CreateApiKeySchema.safeParse({
      provider: 'chutes'
    })
    expect(result.success).toBe(false)
  })

  it('should reject empty api_key', () => {
    const result = CreateApiKeySchema.safeParse({
      provider: 'chutes',
      api_key: ''
    })
    expect(result.success).toBe(false)
  })

  it('should reject non-positive daily_limit', () => {
    const result = CreateApiKeySchema.safeParse({
      provider: 'chutes',
      api_key: 'sk-test-key',
      daily_limit: -1
    })
    expect(result.success).toBe(false)
  })

  it('should reject non-integer daily_limit', () => {
    const result = CreateApiKeySchema.safeParse({
      provider: 'chutes',
      api_key: 'sk-test-key',
      daily_limit: 100.5
    })
    expect(result.success).toBe(false)
  })

  it('should reject non-positive priority', () => {
    const result = CreateApiKeySchema.safeParse({
      provider: 'chutes',
      api_key: 'sk-test-key',
      priority: 0
    })
    expect(result.success).toBe(false)
  })
})

describe('UpdateApiKeySchema', () => {
  it('should validate valid update with daily_limit', () => {
    const result = UpdateApiKeySchema.safeParse({
      daily_limit: 2000
    })
    expect(result.success).toBe(true)
  })

  it('should validate valid update with priority', () => {
    const result = UpdateApiKeySchema.safeParse({
      priority: 2
    })
    expect(result.success).toBe(true)
  })

  it('should validate valid update with is_active', () => {
    const result = UpdateApiKeySchema.safeParse({
      is_active: false
    })
    expect(result.success).toBe(true)
  })

  it('should validate valid update with model_name', () => {
    const result = UpdateApiKeySchema.safeParse({
      model_name: 'gpt-4'
    })
    expect(result.success).toBe(true)
  })

  it('should validate null model_name', () => {
    const result = UpdateApiKeySchema.safeParse({
      model_name: null
    })
    expect(result.success).toBe(true)
  })

  it('should validate multiple fields', () => {
    const result = UpdateApiKeySchema.safeParse({
      daily_limit: 3000,
      priority: 3,
      is_active: true,
      model_name: 'claude-3'
    })
    expect(result.success).toBe(true)
  })

  it('should allow empty object', () => {
    const result = UpdateApiKeySchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('should reject non-positive daily_limit', () => {
    const result = UpdateApiKeySchema.safeParse({
      daily_limit: 0
    })
    expect(result.success).toBe(false)
  })
})

describe('UpdatePromptSchema', () => {
  it('should validate valid update with content', () => {
    const result = UpdatePromptSchema.safeParse({
      content: 'Updated prompt content'
    })
    expect(result.success).toBe(true)
  })

  it('should validate valid update with is_active', () => {
    const result = UpdatePromptSchema.safeParse({
      is_active: true
    })
    expect(result.success).toBe(true)
  })

  it('should validate valid update with description', () => {
    const result = UpdatePromptSchema.safeParse({
      description: 'System prompt for chat'
    })
    expect(result.success).toBe(true)
  })

  it('should validate multiple fields', () => {
    const result = UpdatePromptSchema.safeParse({
      content: 'New content',
      is_active: false,
      description: 'Test description'
    })
    expect(result.success).toBe(true)
  })

  it('should allow empty object', () => {
    const result = UpdatePromptSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})

describe('ValidationError', () => {
  it('should create ValidationError with errors', () => {
    const errors = {
      email: ['Invalid email format'],
      password: ['Password is too short']
    }
    const error = new ValidationError(errors)

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('ValidationError')
    expect(error.message).toBe('Validation failed')
    expect(error.errors).toEqual(errors)
  })

  it('should be throwable and catchable', () => {
    const errors = { field: ['error message'] }
    expect(() => {
      throw new ValidationError(errors)
    }).toThrow(ValidationError)
  })

  it('should preserve errors property when thrown', () => {
    const errors = { test: ['error'] }
    try {
      throw new ValidationError(errors)
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError)
      if (e instanceof ValidationError) {
        expect(e.errors).toEqual(errors)
      }
    }
  })
})

describe('validateRequestBody', () => {
  it('should validate and return parsed data for valid request', async () => {
    const mockRequest = {
      json: async () => ({
        email: 'user@example.com',
        password: 'password123'
      })
    } as unknown as Request

    const result = await validateRequestBody(mockRequest, LoginSchema)
    expect(result).toEqual({
      email: 'user@example.com',
      password: 'password123'
    })
  })

  it('should throw ValidationError for invalid data', async () => {
    const mockRequest = {
      json: async () => ({
        email: 'invalid-email',
        password: '123'
      })
    } as unknown as Request

    await expect(validateRequestBody(mockRequest, LoginSchema))
      .rejects.toThrow(ValidationError)
  })

  it('should populate errors correctly in ValidationError', async () => {
    const mockRequest = {
      json: async () => ({
        email: 'not-an-email',
        password: 'short'
      })
    } as unknown as Request

    try {
      await validateRequestBody(mockRequest, LoginSchema)
      expect.fail('Should have thrown ValidationError')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      if (error instanceof ValidationError) {
        expect(error.errors.email).toBeDefined()
        expect(error.errors.password).toBeDefined()
      }
    }
  })

  it('should handle JSON parse errors', async () => {
    const mockRequest = {
      json: async () => {
        throw new Error('Invalid JSON')
      }
    } as unknown as Request

    await expect(validateRequestBody(mockRequest, LoginSchema))
      .rejects.toThrow()
  })

  it('should validate ChatSchema request', async () => {
    const mockRequest = {
      json: async () => ({
        message: 'Test message',
        conversationId: 'convex-conversation-id',
        language: 'zh'
      })
    } as unknown as Request

    const result = await validateRequestBody(mockRequest, ChatSchema)
    expect(result).toEqual({
      message: 'Test message',
      conversationId: 'convex-conversation-id',
      language: 'zh'
    })
  })

  it('should validate CreateApiKeySchema request', async () => {
    const mockRequest = {
      json: async () => ({
        provider: 'chutes',
        api_key: 'sk-test',
        daily_limit: 1000
      })
    } as unknown as Request

    const result = await validateRequestBody(mockRequest, CreateApiKeySchema)
    expect(result).toEqual({
      provider: 'chutes',
      api_key: 'sk-test',
      daily_limit: 1000
    })
  })
})
