import { getConvexClient } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { logger } from '@/lib/logger';
import type { ApiKeyDoc, ApiKeyWithBackwardsCompat } from '@/lib/types/convex-helpers';
import type { LogApiUsageParams } from '@/lib/types/api-responses';

/**
 * Get an available API key
 * Returns the highest priority key with remaining quota, or the top priority key if all are exhausted
 *
 * NOTE: This function now uses Convex instead of Supabase.
 *
 * @param provider - API provider ('chutes' or 'openrouter')
 * @returns Available API key, or null if none exist
 */
export async function getAvailableApiKey(
  provider: 'chutes' | 'openrouter'
): Promise<ApiKeyWithBackwardsCompat | null> {
  try {
    const convex = getConvexClient();
    const key = await convex.mutation(api.api_keys.getAvailable, { provider });

    if (!key) {
      logger.warn('No available API key', { provider });
      return null;
    }

    return {
      ...key,
      id: key._id, // Backwards compatibility for code expecting .id
    };
  } catch (error) {
    logger.error('Failed to get API key', { error, provider });
    return null;
  }
}

/**
 * Increment API key usage count
 *
 * NOTE: This function now uses Convex instead of Supabase.
 *
 * @param keyId - API key ID
 * @param tokenCount - Number of tokens used
 */
export async function incrementApiKeyUsage(
  keyId: string,
  tokenCount: number = 1
): Promise<void> {
  if (!keyId) {
    logger.warn('incrementApiKeyUsage: keyId is empty');
    return;
  }

  try {
    const convex = getConvexClient();
    await convex.mutation(api.api_keys.incrementUsage, {
      keyId: keyId as Id<"api_keys">,
      tokenCount
    });
  } catch (error) {
    logger.error('Failed to increment API key usage', { error, keyId, tokenCount });
  }
}

/**
 * Log API usage
 * Silently fails without throwing errors to avoid disrupting the main flow
 *
 * NOTE: This function now uses Convex instead of Supabase.
 *
 * @param params - API usage parameters
 */
export async function logApiUsage(params: LogApiUsageParams): Promise<void> {
  try {
    const convex = getConvexClient();
    await convex.mutation(api.api_usage.log, {
      apiKeyId: params.api_key_id as Id<"api_keys">,
      provider: params.provider,
      userId: params.user_id as Id<"users">,
      conversationId: params.conversation_id as Id<"conversations"> | undefined,
      tokensUsed: params.tokens_used,
      success: params.success,
      errorMessage: params.error_message
    });
  } catch (error) {
    // Log failure but don't throw to avoid disrupting the main flow
    logger.error('Failed to log API usage', {
      error: error instanceof Error ? error.message : String(error),
      provider: params.provider,
    });
  }
}
