/**
 * Supabase 类型别名
 * 为常用的数据库类型提供简洁的别名
 */

import type { Database } from './database.types';
import type { SupabaseClient } from '@supabase/supabase-js';

// Supabase Client 类型
export type TypedSupabaseClient = SupabaseClient<Database>;

// 表类型别名
export type User = Database['public']['Tables']['users']['Row'];
export type UserInsert = Database['public']['Tables']['users']['Insert'];
export type UserUpdate = Database['public']['Tables']['users']['Update'];

export type Conversation = Database['public']['Tables']['conversations']['Row'];
export type ConversationInsert = Database['public']['Tables']['conversations']['Insert'];
export type ConversationUpdate = Database['public']['Tables']['conversations']['Update'];

export type Message = Database['public']['Tables']['messages']['Row'];
export type MessageInsert = Database['public']['Tables']['messages']['Insert'];
export type MessageUpdate = Database['public']['Tables']['messages']['Update'];

export type KeyQuote = Database['public']['Tables']['key_quotes']['Row'];
export type KeyQuoteInsert = Database['public']['Tables']['key_quotes']['Insert'];
export type KeyQuoteUpdate = Database['public']['Tables']['key_quotes']['Update'];

export type ApiKey = Database['public']['Tables']['api_keys']['Row'];
export type ApiKeyInsert = Database['public']['Tables']['api_keys']['Insert'];
export type ApiKeyUpdate = Database['public']['Tables']['api_keys']['Update'];

export type ApiUsage = Database['public']['Tables']['api_usage']['Row'];
export type ApiUsageInsert = Database['public']['Tables']['api_usage']['Insert'];
export type ApiUsageUpdate = Database['public']['Tables']['api_usage']['Update'];

export type AdminUser = Database['public']['Tables']['admin_users']['Row'];
export type AdminUserInsert = Database['public']['Tables']['admin_users']['Insert'];
export type AdminUserUpdate = Database['public']['Tables']['admin_users']['Update'];

export type Prompt = Database['public']['Tables']['prompts']['Row'];
export type PromptInsert = Database['public']['Tables']['prompts']['Insert'];
export type PromptUpdate = Database['public']['Tables']['prompts']['Update'];

// 观照系统类型别名
export type GuanzhaoBudgetTracking = Database['public']['Tables']['guanzhao_budget_tracking']['Row'];
export type GuanzhaoBudgetTrackingInsert = Database['public']['Tables']['guanzhao_budget_tracking']['Insert'];
export type GuanzhaoBudgetTrackingUpdate = Database['public']['Tables']['guanzhao_budget_tracking']['Update'];

export type GuanzhaoTriggerHistory = Database['public']['Tables']['guanzhao_trigger_history']['Row'];
export type GuanzhaoTriggerHistoryInsert = Database['public']['Tables']['guanzhao_trigger_history']['Insert'];
export type GuanzhaoTriggerHistoryUpdate = Database['public']['Tables']['guanzhao_trigger_history']['Update'];

export type GuanzhaoSessionEvent = Database['public']['Tables']['guanzhao_session_events']['Row'];
export type GuanzhaoSessionEventInsert = Database['public']['Tables']['guanzhao_session_events']['Insert'];
export type GuanzhaoSessionEventUpdate = Database['public']['Tables']['guanzhao_session_events']['Update'];

export type GuanzhaoSettings = Database['public']['Tables']['guanzhao_settings']['Row'];
export type GuanzhaoSettingsInsert = Database['public']['Tables']['guanzhao_settings']['Insert'];
export type GuanzhaoSettingsUpdate = Database['public']['Tables']['guanzhao_settings']['Update'];

export type GuanzhaoActionHistory = Database['public']['Tables']['guanzhao_action_history']['Row'];
export type GuanzhaoActionHistoryInsert = Database['public']['Tables']['guanzhao_action_history']['Insert'];
export type GuanzhaoActionHistoryUpdate = Database['public']['Tables']['guanzhao_action_history']['Update'];

export type GuanzhaoPushToken = Database['public']['Tables']['guanzhao_push_tokens']['Row'];
export type GuanzhaoPushTokenInsert = Database['public']['Tables']['guanzhao_push_tokens']['Insert'];
export type GuanzhaoPushTokenUpdate = Database['public']['Tables']['guanzhao_push_tokens']['Update'];

// 表名类型(用于类型安全的表名引用)
export type TableName = keyof Database['public']['Tables'];

// 通用查询结果类型
export type QueryResult<T> = {
  data: T | null;
  error: Error | null;
};

export type QueryManyResult<T> = {
  data: T[] | null;
  error: Error | null;
};
