/**
 * 记忆召回模块
 * 从数据库中检索用户记忆并格式化为聊天上下文
 */

import { createClient } from '@/lib/supabase/client';

interface MemoryQuote {
  id: string;
  quote: string;
  context: string | null;
  emotion: string | null;
  topic: string | null;
  created_at: string;
}

interface UserInsights {
  personality: string | null;
  interests: string[] | null;
  concerns: string[] | null;
}

interface RecallResult {
  memories: string[];
  insights: UserInsights;
}

/**
 * 召回用户记忆
 */
export async function recallMemories(
  userId: string,
  options: {
    limit?: number;
    includeContext?: boolean;
  } = {}
): Promise<RecallResult> {
  const supabase = createClient();
  const { limit = 5, includeContext = true } = options;

  // 获取用户的 key_quotes
  const { data: quotes } = await supabase
    .from('key_quotes')
    .select('id, quote, context, emotion, topic, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  // 获取用户画像
  const { data: userData } = await supabase
    .from('users')
    .select('profile')
    .eq('id', userId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = ((userData as any)?.profile as Record<string, unknown>) || {};

  // 格式化记忆为上下文
  const memories = (quotes || []).map((q: MemoryQuote) => {
    let text = `User previously said: "${q.quote}"`;
    if (includeContext && q.context) {
      text += ` (Context: ${q.context.slice(0, 100)}...)`;
    }
    if (q.topic) {
      text += ` [Topic: ${q.topic}]`;
    }
    return text;
  });

  const insights: UserInsights = {
    personality: profile.personality as string | null,
    interests: (profile.interests as string[]) || [],
    concerns: (profile.concerns as string[]) || [],
  };

  return { memories, insights };
}

/**
 * 生成记忆注入上下文
 * 将记忆格式化为系统提示词的一部分
 */
export function formatMemoryContext(
  memories: string[],
  insights: UserInsights
): string {
  const parts: string[] = [];

  if (insights.personality) {
    parts.push(`User personality traits: ${insights.personality}`);
  }

  if (insights.interests && insights.interests.length > 0) {
    parts.push(`User interests: ${insights.interests.join(', ')}`);
  }

  if (insights.concerns && insights.concerns.length > 0) {
    parts.push(`User concerns: ${insights.concerns.join(', ')}`);
  }

  if (memories.length > 0) {
    parts.push('Relevant memories from previous conversations:');
    memories.forEach((m, i) => {
      parts.push(`${i + 1}. ${m}`);
    });
  }

  return parts.length > 0 ? '\n\nUser Context:\n' + parts.join('\n') : '';
}

/**
 * 触发对话记忆提取
 * 在对话结束后异步提取记忆
 */
export async function triggerMemoryExtraction(
  conversationId: string
): Promise<void> {
  try {
    await fetch('/api/memory/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId }),
    });
  } catch (error) {
    console.error('Failed to trigger memory extraction:', error);
  }
}
