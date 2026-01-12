import { NextRequest, NextResponse } from 'next/server';
import { getAvailableApiKey } from '@/lib/api-keys/manager';
import { streamChatCompletion } from '@/lib/llm/chutes';
import { requireAuth } from '@/lib/api/middleware';
import { handleApiError, validationErrorResponse } from '@/lib/api/responses';
import { logger } from '@/lib/logger';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

interface ExtractRequest {
  conversationId: string;
}

interface ExtractedMemory {
  key_quotes?: string[];
  insights?: {
    personality?: string;
    interests?: string[];
    concerns?: string[];
    emotion?: string;
    topic?: string;
  };
}

interface UserProfile {
  personality?: string;
  interests?: string[];
  concerns?: string[];
  last_memory_update?: string;
  [key: string]: unknown;
}

/**
 * 验证对话所有权
 */
async function verifyConversationOwnership(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  conversationId: string,
  userId: string
): Promise<void> {
  const { data: conversation, error } = await supabase
    .from('conversations')
    .select('id, user_id')
    .eq('id', conversationId)
    .single();

  if (error || !conversation) {
    throw new Error('对话不存在');
  }

  if (conversation.user_id !== userId) {
    throw new Error('无权访问此对话');
  }
}

/**
 * 获取对话消息
 */
async function getConversationMessages(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  conversationId: string
): Promise<string> {
  const { data: messages, error } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    logger.error('获取对话消息失败', { error, conversationId });
    throw new Error('获取对话消息失败');
  }

  if (!messages || messages.length === 0) {
    throw new Error('对话没有消息');
  }

  return messages.map((m: { role: string; content: string }) => `${m.role}: ${m.content}`).join('\n');
}

/**
 * 存储提取的记忆
 */
async function storeExtractedQuotes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  conversationId: string,
  quotes: string[],
  conversationContext: string,
  insights?: ExtractedMemory['insights']
): Promise<void> {
  for (const quote of quotes) {
    const { error } = await supabase.from('key_quotes').upsert(
      {
        user_id: userId,
        conversation_id: conversationId,
        quote,
        context: conversationContext.slice(0, 500),
        emotion: insights?.emotion || null,
        topic: insights?.topic || null,
      },
      { onConflict: 'user_id,conversation_id,quote' }
    );

    if (error) {
      logger.warn('存储记忆引用失败', { error, quote: quote.slice(0, 50) });
    }
  }
}

/**
 * 更新用户档案洞察
 */
async function updateUserInsights(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  insights: NonNullable<ExtractedMemory['insights']>
): Promise<void> {
  const { data: existingUser, error: fetchError } = await supabase
    .from('users')
    .select('profile')
    .eq('id', userId)
    .single();

  if (fetchError) {
    logger.warn('获取用户档案失败', { error: fetchError, userId });
    return;
  }

  const currentProfile = (existingUser?.profile as UserProfile) || {};
  const updatedProfile: UserProfile = {
    ...currentProfile,
    personality: insights.personality || currentProfile.personality,
    interests: insights.interests || currentProfile.interests || [],
    concerns: insights.concerns || currentProfile.concerns || [],
    last_memory_update: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from('users')
    .update({ profile: updatedProfile })
    .eq('id', userId);

  if (updateError) {
    logger.error('更新用户档案失败', { error: updateError, userId });
  }
}

/**
 * 解析提取结果
 */
function parseExtractionResult(rawText: string): ExtractedMemory | null {
  try {
    // 提取JSON (可能在markdown代码块中)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn('未找到JSON格式的提取结果');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]) as ExtractedMemory;
    return parsed;
  } catch (error) {
    logger.error('解析提取结果失败', { error, rawText: rawText.slice(0, 200) });
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. 认证用户
    const { user, supabase } = await requireAuth(request);

    // 2. 验证请求体
    const body = await request.json();
    const { conversationId } = body as ExtractRequest;

    if (!conversationId) {
      return validationErrorResponse('缺少对话ID');
    }

    // 3. 验证对话所有权
    await verifyConversationOwnership(supabase, conversationId, user.id);

    // 4. 获取对话内容
    const conversationText = await getConversationMessages(supabase, conversationId);

    // 5. 构建提取Prompt
    const extractionPrompt = `分析以下对话，提取用户的关键信息、重要原话和性格特点。以JSON格式返回：
{
  "key_quotes": ["重要原话1", "重要原话2"],
  "insights": {
    "personality": "性格特点",
    "interests": ["兴趣1", "兴趣2"],
    "concerns": ["关注点1", "关注点2"]
  }
}

对话内容：
${conversationText}`;

    // 6. 获取API密钥
    const apiKey = await getAvailableApiKey('chutes');
    if (!apiKey) {
      logger.error('没有可用的API密钥', { userId: user.id });
      throw new Error('服务暂时不可用');
    }

    // 7. 执行记忆提取
    let extractedData = '';

    await streamChatCompletion(apiKey.api_key, {
      messages: [
        {
          role: 'system',
          content:
            'You are a memory extraction assistant. Extract key information from conversations and respond in JSON format.',
        },
        { role: 'user', content: extractionPrompt },
      ],
      onChunk: (chunk) => {
        extractedData += chunk;
      },
      onComplete: async (fullText) => {
        const parsed = parseExtractionResult(fullText);
        if (!parsed) return;

        // 存储关键引用
        if (parsed.key_quotes && Array.isArray(parsed.key_quotes)) {
          await storeExtractedQuotes(
            supabase,
            user.id,
            conversationId,
            parsed.key_quotes,
            conversationText,
            parsed.insights
          );
        }

        // 更新用户洞察
        if (parsed.insights) {
          await updateUserInsights(supabase, user.id, parsed.insights);
        }
      },
      onError: (error) => {
        logger.error('记忆提取错误', { error, userId: user.id, conversationId });
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, '记忆提取API错误');
  }
}
