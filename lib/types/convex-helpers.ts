/**
 * Convex Document Type Helpers
 * Re-exports commonly used Convex types for type safety
 */

import type { Doc, Id } from '@/convex/_generated/dataModel';

// Document type aliases
export type UserDoc = Doc<'users'>;
export type ConversationDoc = Doc<'conversations'>;
export type MessageDoc = Doc<'messages'>;
export type ApiKeyDoc = Doc<'api_keys'>;
export type ApiUsageDoc = Doc<'api_usage'>;
export type UserSessionDoc = Doc<'user_sessions'>;
export type GuanzhaoBudgetDoc = Doc<'guanzhao_budget_tracking'>;
export type TriggerHistoryDoc = Doc<'guanzhao_trigger_history'>;
export type CooldownDoc = Doc<'guanzhao_cooldowns'>;
export type PushTokenDoc = Doc<'push_tokens'>;
export type PromptDoc = Doc<'prompts'>;
export type KeyQuoteDoc = Doc<'key_quotes'>;

// ID type aliases
export type UserId = Id<'users'>;
export type ConversationId = Id<'conversations'>;
export type MessageId = Id<'messages'>;
export type ApiKeyId = Id<'api_keys'>;
export type UserSessionId = Id<'user_sessions'>;

// Partial update types for mutations
export type UserSessionUpdate = Partial<Pick<UserSessionDoc, 'last_activity_at' | 'ended_at' | 'messages_count'>>;

export type GuanzhaoBudgetUpdate = Partial<Omit<GuanzhaoBudgetDoc, '_id' | '_creationTime' | 'user_id'>>;

export type ConversationUpdate = Partial<Pick<ConversationDoc, 'message_count' | 'last_message_at' | 'updated_at' | 'title'>>;

// API Key with backwards compatibility (id alias for _id)
export interface ApiKeyWithBackwardsCompat extends ApiKeyDoc {
  id: ApiKeyId;
}
