import { NextRequest } from 'next/server';
import { getAvailableApiKey } from '@/lib/api-keys/manager';
import { getActivePrompt } from '@/lib/prompts/manager';
import { streamChatCompletion } from '@/lib/llm/chutes';
import { streamToSSE } from '@/lib/llm/streaming';
import { ChatSchema } from '@/lib/validation/schemas';
import { requireClerkAuth } from '@/lib/api/clerk-middleware';
import { validationErrorResponse, handleApiError } from '@/lib/api/responses';
import { logger } from '@/lib/logger';
import type { ChatMessage } from '@/lib/llm/chutes';

export async function POST(request: NextRequest) {
  try {
    // 1. 认证用户（使用 Clerk）
    const { userId } = await requireClerkAuth();

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

    // 3. 获取API密钥和系统Prompt
    const apiKey = await getAvailableApiKey('chutes');
    if (!apiKey) {
      logger.error('没有可用的API密钥', { userId });
      throw new Error('服务暂时不可用');
    }

    const systemPrompt = await getActivePrompt('formless_elder', language);
    if (!systemPrompt) {
      logger.error('没有找到系统Prompt', { language });
      throw new Error('系统配置错误');
    }

    // 4. 构建消息列表
    // 注意：对话历史现在由前端通过 Convex 管理
    // 这里只需要系统 prompt + 当前用户消息
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ];

    // 5. 流式响应
    return streamToSSE(async (stream) => {
      let tokenCount = 0;

      // 发送对话ID（如果有的话）
      if (conversationId) {
        stream.sendEvent(
          JSON.stringify({ conversationId }),
          'metadata'
        );
      }

      await streamChatCompletion(apiKey.api_key, {
        messages,
        temperature: 0.7,
        max_tokens: 2000,
        onChunk: (chunk) => {
          tokenCount++;
          stream.sendEvent(JSON.stringify({ content: chunk }), 'chunk');
        },
        onComplete: async () => {
          // 消息保存由前端通过 Convex 处理
          // 这里只发送完成信号
          stream.sendEvent(JSON.stringify({ done: true }), 'complete');
          logger.info('聊天完成', { userId, tokenCount });
        },
        onError: (error) => {
          logger.error('聊天流式传输错误', { error, userId });
          stream.sendError(error.message);
        },
      });
    });
  } catch (error) {
    return handleApiError(error, '聊天API错误');
  }
}
