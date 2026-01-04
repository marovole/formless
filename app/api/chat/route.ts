import { NextRequest } from 'next/server';
import { getAvailableApiKey } from '@/lib/api-keys/manager';
import { getActivePrompt } from '@/lib/prompts/manager';
import { streamChatCompletion } from '@/lib/llm/chutes';
import { streamToSSE } from '@/lib/llm/streaming';
import { ChatSchema } from '@/lib/validation/schemas';
import { requireAuth } from '@/lib/api/middleware';
import { validationErrorResponse, handleApiError } from '@/lib/api/responses';
import { logger } from '@/lib/logger';
import type { ChatMessage } from '@/lib/llm/chutes';
import type { Conversation, Message, TypedSupabaseClient } from '@/lib/supabase/types';

/**
 * 验证并获取已有对话
 */
async function getExistingConversation(
  supabase: TypedSupabaseClient,
  conversationId: string,
  userId: string
): Promise<Conversation> {
  const { data: conversation, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (error) {
    logger.error('获取对话失败', { error, conversationId });
    throw new Error('对话不存在');
  }

  if (conversation.user_id !== userId) {
    logger.warn('用户尝试访问他人对话', { userId, conversationId });
    throw new Error('无权访问此对话');
  }

  return conversation;
}

/**
 * 创建新对话
 */
async function createNewConversation(
  supabase: TypedSupabaseClient,
  userId: string,
  language: 'zh' | 'en',
  message: string
): Promise<string> {
  const { data: newConversation, error } = await supabase
    .from('conversations')
    .insert([
      {
        user_id: userId,
        language,
        title: message.slice(0, 50),
      },
    ])
    .select('id')
    .single();

  if (error || !newConversation) {
    logger.error('创建对话失败', { error, userId });
    throw new Error('创建对话失败');
  }

  return newConversation.id;
}

/**
 * 加载对话历史
 */
async function loadConversationHistory(
  supabase: TypedSupabaseClient,
  conversationId: string
): Promise<ChatMessage[]> {
  const { data: messages, error } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    logger.error('加载对话历史失败', { error, conversationId });
    return [];
  }

  if (!messages) {
    return [];
  }

  return messages.map((msg) => ({
    role: msg.role as 'system' | 'user' | 'assistant',
    content: msg.content,
  }));
}

/**
 * 保存用户消息
 */
async function saveUserMessage(
  supabase: TypedSupabaseClient,
  conversationId: string,
  message: string
): Promise<void> {
  const { error } = await supabase.from('messages').insert([
    {
      conversation_id: conversationId,
      role: 'user',
      content: message,
    },
  ]);

  if (error) {
    logger.error('保存用户消息失败', { error, conversationId });
  }
}

/**
 * 保存助手消息
 */
async function saveAssistantMessage(
  supabase: TypedSupabaseClient,
  conversationId: string,
  content: string
): Promise<void> {
  const { error } = await supabase.from('messages').insert([
    {
      conversation_id: conversationId,
      role: 'assistant',
      content,
    },
  ]);

  if (error) {
    logger.error('保存助手消息失败', { error, conversationId });
  }
}

/**
 * 记录API使用情况
 */
async function recordApiUsage(
  supabase: TypedSupabaseClient,
  apiKeyId: string,
  userId: string,
  tokenCount: number
): Promise<void> {
  const { error } = await supabase.from('api_usage').insert([
    {
      api_key_id: apiKeyId,
      provider: 'chutes',
      user_id: userId,
      tokens_used: tokenCount,
      success: true,
    },
  ]);

  if (error) {
    logger.error('记录API使用失败', { error, userId, tokenCount });
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. 认证用户
    const { user, supabase } = await requireAuth(request);

    // 2. 验证请求体
    const body = await request.json();
    const validationResult = ChatSchema.safeParse(body);

    if (!validationResult.success) {
      const errors: Record<string, string[]> = {};
      validationResult.error.issues.forEach((err) => {
        const path = err.path.join('.');
        if (!errors[path]) errors[path] = [];
        errors[path].push(err.message);
      });
      return validationErrorResponse('数据验证失败', errors);
    }

    const { message, conversationId, language = 'zh' } = validationResult.data;

    // 3. 获取或创建对话
    let activeConversationId: string;
    let conversationHistory: ChatMessage[] = [];

    if (conversationId) {
      await getExistingConversation(supabase, conversationId, user.id);
      activeConversationId = conversationId;
      conversationHistory = await loadConversationHistory(supabase, conversationId);
    } else {
      activeConversationId = await createNewConversation(
        supabase,
        user.id,
        language,
        message
      );
    }

    // 4. 获取API密钥和系统Prompt
    const apiKey = await getAvailableApiKey('chutes');
    if (!apiKey) {
      logger.error('没有可用的API密钥', { userId: user.id });
      throw new Error('服务暂时不可用');
    }

    const systemPrompt = await getActivePrompt('formless_elder', language);
    if (!systemPrompt) {
      logger.error('没有找到系统Prompt', { language });
      throw new Error('系统配置错误');
    }

    // 5. 构建消息列表
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message },
    ];

    // 6. 保存用户消息
    await saveUserMessage(supabase, activeConversationId, message);

    // 7. 流式响应
    return streamToSSE(async (stream) => {
      let fullResponse = '';
      let tokenCount = 0;

      // 发送对话ID
      stream.sendEvent(
        JSON.stringify({ conversationId: activeConversationId }),
        'metadata'
      );

      await streamChatCompletion(apiKey.api_key, {
        messages,
        temperature: 0.7,
        max_tokens: 2000,
        onChunk: (chunk) => {
          fullResponse += chunk;
          tokenCount++;
          stream.sendEvent(JSON.stringify({ content: chunk }), 'chunk');
        },
        onComplete: async () => {
          // 保存助手回复
          await saveAssistantMessage(supabase, activeConversationId, fullResponse);

          // 记录API使用
          await recordApiUsage(supabase, apiKey.id, user.id, tokenCount);

          stream.sendEvent(JSON.stringify({ done: true }), 'complete');
        },
        onError: (error) => {
          logger.error('聊天流式传输错误', { error, userId: user.id });
          stream.sendError(error.message);
        },
      });
    });
  } catch (error) {
    return handleApiError(error, '聊天API错误');
  }
}
