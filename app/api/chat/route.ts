import { NextRequest } from 'next/server';
import { streamToSSE } from '@/lib/llm/streaming';
import { ChatSchema } from '@/lib/validation/schemas';
import {
  unauthorizedResponse,
  validationErrorResponse,
  handleApiError,
} from '@/lib/api/responses';
import { checkChatRateLimit } from '@/lib/api/chatRateLimit';
import { logger } from '@/lib/logger';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getConvexAdminClient, getConvexClientWithAuth } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import {
  LLM_DEFAULTS,
  TOOL_MESSAGE_PATTERN,
  CHAT_STREAMING,
} from '@/lib/constants';
import type { ChatMessage } from '@/lib/llm/types';

import { formatMemoryContext } from './utils';
import { getApiKey, getSystemPrompt } from './config';
import { handleStreamingResponse } from './streaming';
import { recallCrossSessionMemories } from './memory';

/**
 * 解析工具消息
 * 客户端工具按钮将显式工具请求编码为用户消息
 * 格式: __tool:{tool_name}__ {json_args}
 */
function parseToolMessage(message: string): { isTool: boolean; effectiveMessage: string } {
  const toolMatch = message.match(TOOL_MESSAGE_PATTERN);
  if (!toolMatch) {
    return { isTool: false, effectiveMessage: message };
  }

  const toolName = toolMatch[1];
  const rawArgs = toolMatch[2];
  try {
    const toolArgs = JSON.parse(rawArgs);
    return {
      isTool: true,
      effectiveMessage: `User confirmed tool action. Call tool "${toolName}" with args: ${JSON.stringify(toolArgs)}.`,
    };
  } catch {
    return { isTool: false, effectiveMessage: message };
  }
}

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  let stageAt = requestStartTime;

  const logStage = (label: string) => {
    const now = Date.now();
    const ms = now - stageAt;
    stageAt = now;
    logger.debug(`[chat] ${label}`, { ms, sinceRequestMs: now - requestStartTime });
  };

  try {
    const [{ userId: clerkId, getToken }, user, body] = await Promise.all([
      auth(),
      currentUser(),
      request.json(),
    ]);

    logStage('auth_parallel');

    if (!clerkId || !user) {
      return unauthorizedResponse();
    }

    const convexToken = await getToken({ template: 'convex' });
    if (!convexToken) {
      return unauthorizedResponse();
    }

    logStage('convex_token');

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

    const rl = checkChatRateLimit(clerkId);
    if (!rl.ok) {
      return new Response(
        JSON.stringify({
          error: 'Too many requests',
          retryAfterMs: rl.retryAfterMs,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)),
          },
        }
      );
    }

    const {
      message,
      conversationId,
      language = CHAT_STREAMING.DEFAULT_LANGUAGE,
    } = validationResult.data;

    const { effectiveMessage } = parseToolMessage(message);

    const convex = getConvexClientWithAuth(convexToken);
    const convexAdmin = getConvexAdminClient();

    const prep = (await convex.mutation(api.chat_prep.prepareChatContext, {
      titleSeed: effectiveMessage.slice(0, LLM_DEFAULTS.TITLE_MAX_LENGTH),
      conversationId: conversationId
        ? (conversationId as Id<'conversations'>)
        : undefined,
      preferredLanguage: language,
      fullName: user.fullName || undefined,
      avatarUrl: user.imageUrl || undefined,
      memoryLimit: CHAT_STREAMING.MEMORY_LIMIT,
      historyLimit: CHAT_STREAMING.HISTORY_MESSAGE_LIMIT,
    })) as {
      convexUserId: Id<'users'>;
      activeConversationId: Id<'conversations'>;
      conversationHistory: Array<{ role: string; content: string }>;
      memorySnapshot: {
        quotes: Array<{ quote: string; context?: string | null }>;
        insights: {
          personality?: string | null;
          interests?: string[];
          concerns?: string[];
        };
      };
    };

    logStage('convex_prepareChat');

    const { convexUserId, activeConversationId, conversationHistory, memorySnapshot } =
      prep;

    const [[apiKey, systemPrompt], crossSessionMemories] = await Promise.all([
      Promise.all([
        getApiKey({ convexAdmin, logger }, clerkId, activeConversationId.toString()),
        getSystemPrompt({ convexAdmin }, language),
      ]),
      recallCrossSessionMemories(convex, effectiveMessage, {
        topK: CHAT_STREAMING.CROSS_SESSION_TOP_K,
        timeoutMs: CHAT_STREAMING.CROSS_SESSION_TIMEOUT_MS,
      }),
    ]);

    logStage('admin_keys_prompt_and_recall');

    const memoryContext = formatMemoryContext(
      memorySnapshot as {
        quotes: Array<{ quote: string; context?: string | null }>;
        insights: {
          personality?: string | null;
          interests?: string[];
          concerns?: string[];
        };
      },
      crossSessionMemories
    );
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

    logStage('append_user_message');

    logger.info('[chat] pre_stream_ready', {
      sinceRequestMs: Date.now() - requestStartTime,
      conversationId: activeConversationId,
    });

    return streamToSSE(async (stream) => {
      await handleStreamingResponse({
        convex,
        convexAdmin,
        logger,
        stream,
        activeConversationId,
        convexUserId,
        messages,
        apiKey,
        requestStartTime,
      });
    });
  } catch (error) {
    return handleApiError(error, 'Chat API error');
  }
}
