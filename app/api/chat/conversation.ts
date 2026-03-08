/**
 * Chat API conversation management
 * Functions for handling conversation creation, retrieval, and message history
 */

import { Id } from '@/convex/_generated/dataModel';
import { api } from '@/convex/_generated/api';

interface ConversationManager {
  convex: any;
  logger: any;
  LLM_DEFAULTS: any;
}

export async function setupConversation(
  { convex, logger, LLM_DEFAULTS }: ConversationManager,
  conversationId: string | undefined,
  effectiveMessage: string,
  clerkId: string
): Promise<{
  activeConversationId: Id<"conversations">;
  conversationHistory: Array<{ role: string; content: string }>;
}> {
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