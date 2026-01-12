import { NextRequest, NextResponse } from 'next/server';
import { streamChatCompletion } from '@/lib/llm/chutes';
import { streamToSSE } from '@/lib/llm/streaming';
import { ChatSchema } from '@/lib/validation/schemas';
import { validationErrorResponse, handleApiError } from '@/lib/api/responses';
import { logger } from '@/lib/logger';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getConvexClient } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { AppError, ExternalServiceError, NotFoundError, ForbiddenError } from '@/lib/errors';

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    const user = await currentUser();

    if (!clerkId || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    const email = user.emailAddresses[0]?.emailAddress;
    if (!email) throw new AppError("User email required", "USER_EMAIL_REQUIRED", 400);

    const convex = getConvexClient();
    const convexUserId = await convex.mutation(api.users.ensure, {
        email,
        clerkId,
        fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined
    });

    let activeConversationId: Id<"conversations">;
    let conversationHistory: any[] = [];

    if (conversationId) {
       const conv = await convex.query(api.conversations.get, { id: conversationId as Id<"conversations"> });
       if (!conv) throw new NotFoundError('对话不存在');
       if (conv.user_id !== convexUserId) throw new ForbiddenError('无权访问此对话');

       activeConversationId = conversationId as Id<"conversations">;
       conversationHistory = await convex.query(api.messages.list, { conversationId: activeConversationId });
    } else {
       activeConversationId = await convex.mutation(api.conversations.createInternal, {
           userId: convexUserId,
           language,
           title: message.slice(0, 50)
       });
    }

    const apiKey = await convex.mutation(api.api_keys.getAvailable, { provider: 'chutes' });
    if (!apiKey) {
      logger.error('没有可用的API密钥', { userId: clerkId });
      throw new AppError('服务暂时不可用', 'SERVICE_UNAVAILABLE', 500);
    }

    const systemPrompt = await convex.query(api.prompts.getActive, { role: 'formless_elder', language });
    if (!systemPrompt) {
      logger.error('没有找到系统Prompt', { language });
      throw new AppError('系统配置错误', 'CONFIG_ERROR', 500);
    }

    const messages = [
      { role: 'system', content: systemPrompt.content },
      ...conversationHistory.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    await convex.mutation(api.messages.insert, {
        conversationId: activeConversationId,
        role: 'user',
        content: message
    });

    return streamToSSE(async (stream) => {
      let fullResponse = '';
      let tokenCount = 0;

      stream.sendEvent(
        JSON.stringify({ conversationId: activeConversationId }),
        'metadata'
      );

      await streamChatCompletion(apiKey.api_key, {
        messages: messages as any[],
        temperature: 0.7,
        max_tokens: 2000,
        onChunk: (chunk) => {
          fullResponse += chunk;
          tokenCount++;
          stream.sendEvent(JSON.stringify({ content: chunk }), 'chunk');
        },
        onComplete: async () => {
          await convex.mutation(api.messages.insert, {
             conversationId: activeConversationId,
             role: 'assistant',
             content: fullResponse,
             tokens: tokenCount
          });

          await convex.mutation(api.api_usage.log, {
              apiKeyId: apiKey._id,
              provider: 'chutes',
              userId: convexUserId,
              tokensUsed: tokenCount,
              success: true
          });

          await convex.mutation(api.api_keys.incrementUsage, {
              keyId: apiKey._id,
              tokenCount
          });

          stream.sendEvent(JSON.stringify({ done: true }), 'complete');
        },
        onError: (error) => {
          logger.error('聊天流式传输错误', { error, userId: clerkId });
          stream.sendError(error.message);
        },
      });
    });

  } catch (error) {
    return handleApiError(error, '聊天API错误');
  }
}
