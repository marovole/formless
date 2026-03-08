import { NextRequest } from 'next/server';
import { streamToSSE } from '@/lib/llm/streaming';
import { ChatSchema } from '@/lib/validation/schemas';
import { unauthorizedResponse, validationErrorResponse, handleApiError } from '@/lib/api/responses';
import { logger } from '@/lib/logger';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getConvexAdminClient, getConvexClientWithAuth } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { LLM_DEFAULTS } from '@/lib/constants';
import type { ChatMessage } from '@/lib/llm/types';

import { tryBuildSuggestions } from './suggestions';
import { formatMemoryContext } from './utils';
import { setupConversation } from './conversation';
import { getApiKey, getSystemPrompt } from './config';
import { handleStreamingResponse } from './streaming';

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

    const { activeConversationId, conversationHistory } = await setupConversation(
      { convex, logger, LLM_DEFAULTS },
      conversationId || undefined,
      effectiveMessage,
      clerkId
    );

    const apiKey = await getApiKey({ convexAdmin, logger }, clerkId, activeConversationId.toString());
    const systemPrompt = await getSystemPrompt({ convexAdmin }, language);

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
