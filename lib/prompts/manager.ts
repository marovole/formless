import { getConvexClient } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import { logger } from '@/lib/logger';

type PromptRole = 'formless_elder' | 'memory_extractor' | 'system';
type Language = 'zh' | 'en';

/**
 * 获取激活的Prompt内容
 *
 * NOTE: This function now uses Convex instead of Supabase.
 *
 * @param role - Prompt角色类型
 * @param language - 语言
 * @returns Prompt内容,如果未找到则返回null
 */
export async function getActivePrompt(
  role: PromptRole,
  language: Language
): Promise<string | null> {
  try {
    const convex = getConvexClient();
    const prompt = await convex.query(api.prompts.getActive, {
      role,
      language
    });

    if (!prompt) {
      logger.warn('未找到激活的Prompt', { role, language });
      return null;
    }

    return prompt.content;
  } catch (error) {
    logger.error('获取Prompt失败', { error, role, language });
    return null;
  }
}
