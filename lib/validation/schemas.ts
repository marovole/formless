import { z } from 'zod'

/**
 * Login request validation schema
 */
export const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export type LoginInput = z.infer<typeof LoginSchema>

/**
 * Chat request validation schema
 */
export const ChatSchema = z.object({
  message: z.string().min(1, 'Message is required').max(5000, 'Message too long'),
  conversationId: z.string().optional(),
  language: z.enum(['zh', 'en']).optional(),
})

export type ChatInput = z.infer<typeof ChatSchema>

/**
 * Memory extract request validation schema
 */
export const ExtractRequestSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID'),
  userId: z.string().uuid('Invalid user ID').optional(),
})

export type ExtractRequestInput = z.infer<typeof ExtractRequestSchema>

/**
 * Create API Key validation schema
 */
export const CreateApiKeySchema = z.object({
  provider: z.enum(['chutes', 'openrouter'], 'Invalid provider'),
  api_key: z.string().min(1, 'API key is required'),
  model_name: z.string().optional(),
  daily_limit: z.number().int().positive().optional(),
  priority: z.number().int().positive().optional(),
})

export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>

/**
 * Update API Key validation schema
 */
export const UpdateApiKeySchema = z.object({
  daily_limit: z.number().int().positive().optional(),
  priority: z.number().int().positive().optional(),
  is_active: z.boolean().optional(),
  model_name: z.string().nullable().optional(),
})

export type UpdateApiKeyInput = z.infer<typeof UpdateApiKeySchema>

/**
 * Update Prompt validation schema
 */
export const UpdatePromptSchema = z.object({
  content: z.string().optional(),
  is_active: z.boolean().optional(),
  description: z.string().optional(),
})

export type UpdatePromptInput = z.infer<typeof UpdatePromptSchema>

/**
 * Validation error response helper
 */
export class ValidationError extends Error {
  constructor(public errors: Record<string, string[]>) {
    super('Validation failed')
    this.name = 'ValidationError'
  }
}

/**
 * Helper function to validate request body against a schema
 */
export async function validateRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<T> {
  try {
    const body = await request.json()
    return schema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string[]> = {}
      error.issues.forEach((err) => {
        const path = err.path.join('.')
        if (!errors[path]) {
          errors[path] = []
        }
        errors[path].push(err.message)
      })
      throw new ValidationError(errors)
    }
    throw error
  }
}
