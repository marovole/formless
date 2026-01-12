import { getConvexClient } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { logger } from '@/lib/logger';

/**
 * 获取可用的API密钥
 * 按优先级返回有配额的密钥,如果都超限则返回优先级最高的
 *
 * NOTE: This function now uses Convex instead of Supabase.
 *
 * @param provider - API提供商
 * @returns 可用的API密钥,如果没有则返回null
 */
export async function getAvailableApiKey(
  provider: 'chutes' | 'openrouter'
): Promise<any | null> {
  try {
    const convex = getConvexClient();
    const key = await convex.mutation(api.api_keys.getAvailable, { provider });

    if (!key) {
      logger.warn('没有可用的API密钥', { provider });
      return null;
    }

    return {
      ...key,
      id: key._id, // Backwards compatibility for code expecting .id
    };
  } catch (error) {
    logger.error('获取API密钥失败', { error, provider });
    return null;
  }
}

/**
 * 增加API密钥的使用次数
 *
 * NOTE: This function now uses Convex instead of Supabase.
 *
 * @param keyId - API密钥ID
 * @param tokenCount - 使用的token数量
 */
export async function incrementApiKeyUsage(
  keyId: string,
  tokenCount: number = 1
): Promise<void> {
  if (!keyId) {
    logger.warn('incrementApiKeyUsage: keyId为空');
    return;
  }

  try {
    const convex = getConvexClient();
    await convex.mutation(api.api_keys.incrementUsage, {
      keyId: keyId as Id<"api_keys">,
      tokenCount
    });
  } catch (error) {
    logger.error('增加API密钥使用量失败', { error, keyId, tokenCount });
  }
}

/**
 * 记录API使用情况
 * 失败不抛出错误,只记录日志
 *
 * NOTE: This function now uses Convex instead of Supabase.
 *
 * @param params - API使用参数
 */
export async function logApiUsage(params: any): Promise<void> {
  try {
    const convex = getConvexClient();
    await convex.mutation(api.api_usage.log, {
      apiKeyId: params.api_key_id as Id<"api_keys">,
      provider: params.provider,
      userId: params.user_id as Id<"users">,
      tokensUsed: params.tokens_used,
      success: params.success,
      errorMessage: params.error_message
    });
  } catch (error) {
    // 记录失败但不抛出错误,避免影响主流程
    logger.error('记录API使用情况失败', {
      error: error instanceof Error ? error.message : String(error),
      provider: params.provider,
    });
  }
}
