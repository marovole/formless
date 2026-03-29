/**
 * Chat API conversation management
 * Functions for handling conversation creation, retrieval, and message history
 */

import type { Id } from '@/convex/_generated/dataModel';
import { api } from '@/convex/_generated/api';
import type { EdgeConvexClient } from '@/lib/convex';

/**
 * 日志接口 - 仅依赖所需方法
 */
interface ConversationLogger {
  warn(message: string, context?: Record<string, unknown>): void;
}

/**
 * LLM 常量接口 - 仅依赖所需属性
 */
interface ConversationConstants {
  TITLE_MAX_LENGTH: number;
}

/**
 * 对话管理器依赖接口
 */
interface ConversationManager {
  convex: EdgeConvexClient;
  logger: ConversationLogger;
  LLM_DEFAULTS: ConversationConstants;
}

/**
 * 设置对话上下文
 * 获取或创建对话，并加载历史消息
 */
export async function setupConversation(
  { convex, logger, LLM_DEFAULTS }: ConversationManager,
  conversationId: string | undefined,
  effectiveMessage: string,
  clerkId: string
): Promise<{
  activeConversationId: Id<'conversations'>;
  conversationHistory: Array<{ role: string; content: string }>;
}> {
  let activeConversationId: Id<'conversations'>;
  let conversationHistory: Array<{ role: string; content: string }> = [];

  if (conversationId) {
    const convId = conversationId as Id<'conversations'>;
    const conv = await convex.query(api.conversations.get, { id: convId });

    if (!conv) {
      logger.warn('Conversation not found, creating a new one', {
        conversationId: convId,
        userId: clerkId,
      });
      activeConversationId = await convex.mutation(api.conversations.create, {
        language: 'zh', // Default language
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
      language: 'zh', // Default language
      title: effectiveMessage.slice(0, LLM_DEFAULTS.TITLE_MAX_LENGTH),
    });
  }

  return { activeConversationId, conversationHistory };
}
