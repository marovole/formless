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
import { AppError, NotFoundError, ForbiddenError } from '@/lib/errors';
import { LLM_DEFAULTS } from '@/lib/constants';
import type { ChatMessage } from '@/lib/llm/types';
import type { MessageDoc } from '@/lib/types/convex-helpers';

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
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
      return validationErrorResponse('Validation failed', errors);
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
    let conversationHistory: MessageDoc[] = [];

    if (conversationId) {
       const conv = await convex.query(api.conversations.get, { id: conversationId as Id<"conversations"> });
       if (!conv) throw new NotFoundError('Conversation not found');
       if (conv.user_id !== convexUserId) throw new ForbiddenError('Access denied');

       activeConversationId = conversationId as Id<"conversations">;
       conversationHistory = await convex.query(api.messages.list, { conversationId: activeConversationId });
    } else {
       activeConversationId = await convex.mutation(api.conversations.createInternal, {
           userId: convexUserId,
           language,
           title: message.slice(0, LLM_DEFAULTS.TITLE_MAX_LENGTH)
       });
    }

    const apiKey = await convex.mutation(api.api_keys.getAvailable, { provider: 'chutes' });
    if (!apiKey) {
      logger.error('No available API key', { userId: clerkId });
      throw new AppError('Service temporarily unavailable', 'SERVICE_UNAVAILABLE', 500);
    }

    const systemPrompt = await convex.query(api.prompts.getActive, { role: 'formless_elder', language });
    if (!systemPrompt) {
      logger.error('System prompt not found', { language });
      throw new AppError('Configuration error', 'CONFIG_ERROR', 500);
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt.content },
      ...conversationHistory.map(m => ({ role: m.role as ChatMessage['role'], content: m.content })),
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
        messages,
        temperature: LLM_DEFAULTS.TEMPERATURE,
        max_tokens: LLM_DEFAULTS.MAX_TOKENS,
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
              modelName: apiKey.model_name,
              userId: convexUserId,
              conversationId: activeConversationId,
              tokensUsed: tokenCount,
              success: true,
              responseTimeMs: Date.now() - requestStartTime
          });

          await convex.mutation(api.api_keys.incrementUsage, {
              keyId: apiKey._id,
              tokenCount
          });

          stream.sendEvent(JSON.stringify({ done: true }), 'complete');
        },
        onError: (error) => {
          logger.error('Chat streaming error', { error, userId: clerkId });
          stream.sendError(error.message);
        },
      });
    });

  } catch (error) {
    return handleApiError(error, 'Chat API error');
  }
}
