/**
 * API Response Types
 * Standardized response interfaces for API routes
 */

import type { Id } from '@/convex/_generated/dataModel';
import type { Template } from '@/lib/guanzhao/types';

/**
 * Session event mutation response
 */
export interface SessionEventResponse {
  success: boolean;
  sessionId?: Id<'user_sessions'>;
  shouldTrigger?: {
    triggerId: string;
    reason: string;
  };
  error?: string;
}

/**
 * Guanzhao trigger evaluation response
 */
export interface TriggerEvaluationResponse {
  allowed: boolean;
  reason?: string;
  userId?: Id<'users'>;
  userSettings?: Record<string, unknown>;
  snoozedUntil?: string;
  cooldownUntil?: string;
}

/**
 * Guanzhao action response
 */
export interface ActionResponse {
  success?: boolean;
  message?: string;
  redirectUrl?: string;
  error?: string;
}

/**
 * Memory preparation result
 */
export interface MemoryPreparation {
  userId: Id<'users'>;
  conversationText: string;
}

/**
 * Trigger with template response
 */
export interface TriggerWithTemplateResponse {
  allowed: boolean;
  template?: Template;
  historyId?: Id<'guanzhao_trigger_history'>;
  reason?: string;
}

/**
 * API usage log parameters
 */
export interface LogApiUsageParams {
  api_key_id: string;
  provider: string;
  user_id: string;
  tokens_used: number;
  success: boolean;
  error_message?: string;
  conversation_id?: string;
}

/**
 * Guanzhao settings update payload
 */
export interface GuanzhaoSettingsUpdate {
  enabled?: boolean;
  frequency_level?: string;
  push_enabled?: boolean;
  dnd_start?: string;
  dnd_end?: string;
  style?: string;
  snoozed_until?: string | null;
}
