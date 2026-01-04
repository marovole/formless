import { getSupabaseAdminClient } from '@/lib/supabase/server';
import type { ApiKey, ApiUsageInsert } from '@/lib/supabase/types';
import { logger } from '@/lib/logger';

/**
 * 获取可用的API密钥
 * 按优先级返回有配额的密钥,如果都超限则返回优先级最高的
 *
 * @param provider - API提供商
 * @returns 可用的API密钥,如果没有则返回null
 */
export async function getAvailableApiKey(
  provider: 'chutes' | 'openrouter'
): Promise<ApiKey | null> {
  const supabase = getSupabaseAdminClient();

  // 获取当前日期用于每日重置检查
  const today = new Date().toISOString().split('T')[0];

  const { data: keys, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('provider', provider)
    .eq('is_active', true)
    .order('priority', { ascending: true });

  if (error) {
    logger.error('获取API密钥失败', { error, provider });
    return null;
  }

  if (!keys || keys.length === 0) {
    logger.warn('没有可用的API密钥', { provider });
    return null;
  }

  // 查找第一个有可用配额的密钥
  for (const key of keys) {
    // 如果是新的一天,重置 daily_used
    const keyDate = key.reset_at ? key.reset_at.split('T')[0] : null;
    if (keyDate !== today) {
      const { error: updateError } = await supabase
        .from('api_keys')
        .update({ daily_used: 0, reset_at: new Date().toISOString() })
        .eq('id', key.id);

      if (updateError) {
        logger.warn('重置API密钥使用量失败', { error: updateError, keyId: key.id });
      } else {
        key.daily_used = 0;
      }
    }

    if (key.daily_used < key.daily_limit) {
      return key;
    }
  }

  // 如果所有密钥都超限,返回第一个(优先级最高的)
  logger.warn('所有API密钥都已超过每日限额', { provider });
  return keys[0];
}

/**
 * 增加API密钥的使用次数
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

  const supabase = getSupabaseAdminClient();

  // 直接使用原子增量更新
  const { error } = await supabase
    .from('api_keys')
    .update({
      daily_used: supabase.rpc('increment', { amount: tokenCount, row_id: keyId }),
      last_used_at: new Date().toISOString(),
    })
    .eq('id', keyId);

  if (error) {
    logger.error('增加API密钥使用量失败', { error, keyId, tokenCount });
  }
}

/**
 * 记录API使用情况
 * 失败不抛出错误,只记录日志
 *
 * @param params - API使用参数
 */
export async function logApiUsage(params: ApiUsageInsert): Promise<void> {
  const supabase = getSupabaseAdminClient();

  const { error } = await supabase.from('api_usage').insert([params]);

  if (error) {
    // 记录失败但不抛出错误,避免影响主流程
    logger.error('记录API使用情况失败', {
      error: error.message,
      code: error.code,
      provider: params.provider,
    });
  }
}
