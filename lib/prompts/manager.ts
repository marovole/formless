import { getSupabaseAdminClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

type PromptRole = 'formless_elder' | 'memory_extractor' | 'system';
type Language = 'zh' | 'en';

/**
 * 获取激活的Prompt内容
 *
 * @param role - Prompt角色类型
 * @param language - 语言
 * @returns Prompt内容,如果未找到则返回null
 */
export async function getActivePrompt(
  role: PromptRole,
  language: Language
): Promise<string | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from('prompts')
    .select('content')
    .eq('role', role)
    .eq('language', language)
    .eq('is_active', true)
    .limit(1);

  if (error) {
    logger.error('获取Prompt失败', { error, role, language });
    return null;
  }

  if (!data || data.length === 0) {
    logger.warn('未找到激活的Prompt', { role, language });
    return null;
  }

  return data[0]?.content || null;
}
