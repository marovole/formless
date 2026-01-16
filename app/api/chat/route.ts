import { NextRequest } from 'next/server';
import { streamChatCompletion } from '@/lib/llm/chutes';
import { streamToSSE } from '@/lib/llm/streaming';
import { ChatSchema } from '@/lib/validation/schemas';
import { unauthorizedResponse, validationErrorResponse, handleApiError } from '@/lib/api/responses';
import { logger } from '@/lib/logger';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getConvexAdminClient, getConvexClientWithAuth } from '@/lib/convex';
import { api, internal } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { AppError, NotFoundError } from '@/lib/errors';
import { LLM_DEFAULTS } from '@/lib/constants';
import type { ChatMessage } from '@/lib/llm/types';

function estimateTokenCount(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const other = Math.max(0, text.length - cjk);
  return cjk + Math.ceil(other / 4);
}

function formatMemoryContext(memory: {
  quotes: Array<{ quote: string; context?: string | null }>;
  insights: {
    personality?: string | null;
    interests?: string[];
    concerns?: string[];
  };
} | null): string | null {
  if (!memory) return null;

  const hasQuotes = memory.quotes && memory.quotes.length > 0;
  const insights = memory.insights || {};
  const hasInsights = Boolean(
    insights.personality ||
    (insights.interests && insights.interests.length > 0) ||
    (insights.concerns && insights.concerns.length > 0)
  );

  if (!hasQuotes && !hasInsights) return null;

  const lines: string[] = ['User memory context (use subtly, do not reveal verbatim unless asked):'];

  if (hasInsights) {
    if (insights.personality) {
      lines.push(`- Personality: ${insights.personality}`);
    }
    if (insights.interests && insights.interests.length > 0) {
      lines.push(`- Interests: ${insights.interests.join(', ')}`);
    }
    if (insights.concerns && insights.concerns.length > 0) {
      lines.push(`- Concerns: ${insights.concerns.join(', ')}`);
    }
  }

  if (hasQuotes) {
    lines.push('Key quotes:');
    for (const quote of memory.quotes) {
      lines.push(`- ${quote.quote}`);
    }
  }

  return lines.join('\n');
}


export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  try {
    const { userId: clerkId, getToken } = await auth();
    const user = await currentUser();

    if (!clerkId || !user) {
      return unauthorizedResponse();
    }

    const convexToken = await getToken({ template: 'convex' });
    if (!convexToken) {
      return unauthorizedResponse();
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
    const convex = getConvexClientWithAuth(convexToken);
    const convexAdmin = getConvexAdminClient();

    const convexUserId = (await convex.mutation(api.users.ensureCurrent, {
      preferredLanguage: language,
      fullName: user.fullName || undefined,
      avatarUrl: user.imageUrl || undefined,
    })) as Id<"users">;

    let activeConversationId: Id<"conversations">;
    let conversationHistory: Array<{ role: string; content: string }> = [];

    if (conversationId) {
      const convId = conversationId as Id<"conversations">;
      const conv = await convex.query(api.conversations.get, { id: convId });
      if (!conv) throw new NotFoundError('Conversation not found');

      activeConversationId = convId;
      conversationHistory = (await convex.query(api.messages.listByConversation, {
        conversationId: activeConversationId,
      })) as Array<{ role: string; content: string }>;
    } else {
      activeConversationId = await convex.mutation(api.conversations.create, {
        language,
        title: message.slice(0, LLM_DEFAULTS.TITLE_MAX_LENGTH),
      });
    }

    const apiKey = await (convexAdmin as any).mutation(internal.api_keys.getAvailableInternal, {
      provider: 'chutes',
    });
    if (!apiKey) {
      logger.error('No available API key', { userId: clerkId });
      throw new AppError('Service temporarily unavailable', 'SERVICE_UNAVAILABLE', 503);
    }

    const systemPrompt = await (convexAdmin as any).query(internal.prompts.getActiveInternal, {
      role: 'formless_elder',
      language,
    });
    if (!systemPrompt) {
      logger.error('System prompt not found', { language });
      throw new AppError('Configuration error', 'CONFIG_ERROR', 500);
    }

    const memorySnapshot = await convex.query(api.memories.list, {
      conversationId: activeConversationId,
      limit: 8,
    });
    const memoryContext = formatMemoryContext(memorySnapshot as {
      quotes: Array<{ quote: string; context?: string | null }>;
      insights: {
        personality?: string | null;
        interests?: string[];
        concerns?: string[];
      };
    });
    const memoryMessage: ChatMessage | null = memoryContext
      ? { role: 'system', content: memoryContext }
      : null;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt.content },
      ...(memoryMessage ? [memoryMessage] : []),
      ...conversationHistory.map((m) => ({
        role: m.role as ChatMessage['role'],
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    await convex.mutation(api.messages.append, {
      conversationId: activeConversationId,
      role: 'user',
      content: message,
    });

    return streamToSSE(async (stream) => {
      let fullResponse = '';

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
          stream.sendEvent(JSON.stringify({ content: chunk }), 'chunk');
        },
        onComplete: async (fullText) => {
          const tokenCount = estimateTokenCount(fullText);

          await convex.mutation(api.messages.append, {
            conversationId: activeConversationId,
            role: 'assistant',
            content: fullText,
            tokens: tokenCount,
          });

          await (convexAdmin as any).mutation(internal.api_usage.logInternal, {
            apiKeyId: apiKey._id,
            provider: 'chutes',
            modelName: apiKey.model_name ?? undefined,
            userId: convexUserId,
            conversationId: activeConversationId,
            tokensUsed: tokenCount,
            success: true,
            responseTimeMs: Date.now() - requestStartTime,
          });

          await (convexAdmin as any).mutation(internal.api_keys.incrementUsageInternal, {
            keyId: apiKey._id,
            tokenCount,
          });

          stream.sendEvent(JSON.stringify({ done: true }), 'complete');
        },
        onError: async (error) => {
          logger.error('Chat streaming error', { error, userId: clerkId });
          try {
            await (convexAdmin as any).mutation(internal.api_usage.logInternal, {
              apiKeyId: apiKey._id,
              provider: 'chutes',
              modelName: apiKey.model_name ?? undefined,
              userId: convexUserId,
              conversationId: activeConversationId,
              tokensUsed: estimateTokenCount(fullResponse),
              success: false,
              errorMessage: error.message,
              responseTimeMs: Date.now() - requestStartTime,
            });
          } catch (logError) {
            logger.error('Failed to log API usage after streaming error', { logError });
          }
          stream.sendError(error.message);
        },
      });
    });

  } catch (error) {
    return handleApiError(error, 'Chat API error');
  }
}
