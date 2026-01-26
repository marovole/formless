import { NextRequest } from 'next/server';
import { streamChatCompletionWithProvider } from '@/lib/llm/client';
import { streamToSSE } from '@/lib/llm/streaming';
import { ChatSchema } from '@/lib/validation/schemas';
import { unauthorizedResponse, validationErrorResponse, handleApiError } from '@/lib/api/responses';
import { logger } from '@/lib/logger';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getConvexAdminClient, getConvexClientWithAuth } from '@/lib/convex';
import { api, internal } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { ConfigError } from '@/lib/errors';
import { LLM_DEFAULTS } from '@/lib/constants';
import type { ChatMessage } from '@/lib/llm/types';
import { runMemoryAgentLoop } from '@/lib/agent/loop';

function tryBuildSuggestions(text: string, language: string) {
  const lower = text.toLowerCase();
  const isSleep = /睡不着|失眠|睡眠/.test(text) || lower.includes('insomnia');
  const isAnxious = /焦虑|紧张|压力/.test(text) || lower.includes('anxious') || lower.includes('anxiety');
  if (!isSleep && !isAnxious) return null;

  if (language === 'en') {
    return {
      suggestions: [
        {
          tool: 'get_meditation_audio',
          label: 'Play a 5-min breathing practice',
          params: { mood: isSleep ? 'insomnia' : 'anxiety', duration: 5, style: 'breathing', language: 'en' },
        },
        {
          tool: 'search_books',
          label: 'Recommend a book for this',
          params: { query: isSleep ? 'sleep' : 'anxiety', language: 'en', limit: 3 },
        },
      ],
    };
  }

  return {
    suggestions: [
      {
        tool: 'get_meditation_audio',
        label: '放一段 5 分钟呼吸练习',
        params: { mood: isSleep ? '失眠' : '焦虑', duration: 5, style: 'breathing', language: 'zh' },
      },
      {
        tool: 'search_books',
        label: '推荐一本相关的书',
        params: { query: isSleep ? '睡眠' : '焦虑', language: 'zh', limit: 3 },
      },
    ],
  };
}

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

    // Client-side tool button encodes explicit tool request as a user message.
    let effectiveMessage = message;
    const toolMatch = message.match(/^__tool:([a-z_]+)__\s*(\{[\s\S]*\})$/);
    if (toolMatch) {
      const toolName = toolMatch[1];
      const rawArgs = toolMatch[2];
      try {
        const toolArgs = JSON.parse(rawArgs);
        effectiveMessage = `User confirmed tool action. Call tool "${toolName}" with args: ${JSON.stringify(toolArgs)}.`;
      } catch {
        // fall through
      }
    }
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

      if (!conv) {
        logger.warn('Conversation not found, creating a new one', {
          conversationId: convId,
          userId: clerkId,
        });
        activeConversationId = await convex.mutation(api.conversations.create, {
          language,
          title: effectiveMessage.slice(0, LLM_DEFAULTS.TITLE_MAX_LENGTH),
        });
      } else {
        activeConversationId = convId;
        conversationHistory = (await convex.query(api.messages.listByConversation, {
          conversationId: activeConversationId,
        })) as Array<{ role: string; content: string }>;
      }
    } else {
      activeConversationId = await convex.mutation(api.conversations.create, {
        language,
        title: effectiveMessage.slice(0, LLM_DEFAULTS.TITLE_MAX_LENGTH),
      });
    }

    const apiKey = await (convexAdmin as any).mutation(internal.api_keys.getAvailableInternal, {
      provider: 'openrouter',
    });
    if (!apiKey) {
      logger.error('No available API key', {
        provider: 'openrouter',
        userId: clerkId,
        conversationId: activeConversationId,
      });
      throw new ConfigError('OpenRouter API key is not configured');
    }

    const systemPrompt = await (convexAdmin as any).query(internal.prompts.getActiveInternal, {
      role: 'formless_elder',
      language,
    });
    if (!systemPrompt) {
      logger.error('System prompt not found', { language });
      throw new ConfigError('Configuration error');
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
      { role: 'user', content: effectiveMessage },
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

      const suggestionsPayload = tryBuildSuggestions(message, language);
      if (suggestionsPayload) {
        stream.sendEvent(JSON.stringify(suggestionsPayload), 'suggestion');
      }

      const enableAgentMemory = process.env.AGENT_MEMORY === 'true';
      const deepSeekApiKey = process.env.DEEPSEEK_API_KEY;
      const deepSeekBaseUrl = process.env.DEEPSEEK_ANTHROPIC_BASE_URL;
      const deepSeekModel = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

      if (enableAgentMemory) {
        try {
          const provider = deepSeekApiKey ? 'deepseek' : 'openrouter';
          const apiKeyForProvider = deepSeekApiKey || apiKey.api_key;
          const modelForProvider = deepSeekApiKey
            ? deepSeekModel
            : (apiKey.model_name || 'anthropic/claude-3.7-sonnet');

          logger.info('Agent memory provider selected', {
            conversationId: activeConversationId,
            provider,
            model: modelForProvider,
            hasDeepSeekApiKey: Boolean(deepSeekApiKey),
            deepSeekBaseUrlSet: Boolean(deepSeekBaseUrl),
          });

          const { finalContent } = await runMemoryAgentLoop({
            convex,
            provider,
            apiKey: apiKeyForProvider,
            model: modelForProvider,
            baseUrl: deepSeekBaseUrl,
            messages,
            conversationId: activeConversationId,
          });

          const maybeAudio = finalContent.match(/\[AUDIO\]\s*(\{[\s\S]*\})/);
          if (maybeAudio) {
            try {
              const audioPayload = JSON.parse(maybeAudio[1]);
              stream.sendEvent(JSON.stringify(audioPayload), 'audio');
            } catch {
              // ignore
            }
          }

          fullResponse = finalContent;
          // Emit in small chunks so the client sees incremental updates.
          const chunkSize = 120;
          for (let i = 0; i < finalContent.length; i += chunkSize) {
            const piece = finalContent.slice(i, i + chunkSize);
            stream.sendEvent(JSON.stringify({ content: piece }), 'chunk');
          }

          const tokenCount = estimateTokenCount(finalContent);
          await convex.mutation(api.messages.append, {
            conversationId: activeConversationId,
            role: 'assistant',
            content: finalContent,
            tokens: tokenCount,
          });

          await (convexAdmin as any).mutation(internal.api_usage.logInternal, {
            apiKeyId: apiKey._id,
            provider: 'openrouter',
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
          return;
        } catch (error) {
          logger.error('Agent memory loop error, falling back to streaming', { error });
        }
      }

      await streamChatCompletionWithProvider('openrouter', apiKey.api_key, {
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
            provider: 'openrouter',
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
              provider: 'openrouter',
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
