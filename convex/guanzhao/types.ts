import { Doc, Id } from "../_generated/dataModel";

// ============================================================================
// Type Definitions for Guanzhao (Mindfulness) System
// ============================================================================

export type GuanzhaoConfig = typeof import("../../docs/guanzhao/guanzhao-bundle.json");
export type GuanzhaoTrigger = GuanzhaoConfig["triggers"][number];
export type GuanzhaoTemplate = GuanzhaoConfig["templates"][number];

export interface SessionEventResponse {
  success?: boolean;
  sessionId?: Id<'user_sessions'>;
  shouldTrigger?: {
    triggerId: string;
    reason: string;
  };
  error?: string;
}

export interface ActionResponse {
  success?: boolean;
  message?: string;
  redirectUrl?: string;
  error?: string;
}

export type UserSessionUpdate = Partial<Pick<Doc<'user_sessions'>, 'last_activity_at' | 'ended_at' | 'messages_count'>>;

export interface BudgetUpdate {
  updated_at?: number;
  used_in_app_day?: number;
  used_in_app_week?: number;
  used_push_day?: number;
  used_push_week?: number;
}