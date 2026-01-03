/**
 * 观照系统全局类型定义
 * 导出所有观照相关的类型供其他文件使用
 */

// =============================================
// 从 lib/guanzhao/config.ts 导出的类型
// =============================================

export interface GuanzhaoConfig {
  schema_version: number;
  feature_id: string;
  feature_name_zh: string;
  persona: Persona;
  defaults: Defaults;
  frequency_levels: Record<string, FrequencyLevel>;
  global_rules: GlobalRules;
  actions: Record<string, Action>;
  templates: Template[];
  triggers: Trigger[];
}

export interface Persona {
  id: string;
  name_zh: string;
  positioning_zh: string;
  tone_styles: Record<string, string>;
  principles: string[];
}

export interface Defaults {
  enabled: boolean;
  frequency_level: string;
  style: string;
  channels: {
    in_app: boolean;
    push: boolean;
  };
  dnd_local_time: {
    start: string;
    end: string;
  };
}

export interface FrequencyLevel {
  label_zh: string;
  budgets: {
    in_app: {
      per_day: number;
      per_week: number;
    };
    push: {
      per_day: number;
      per_week: number;
    };
  };
  safeguards?: {
    push?: {
      stop_after_consecutive_ignored?: number;
      suppress_in_dnd?: boolean;
    };
    in_app?: {
      max_interruptions_per_session?: number;
    };
  };
}

export interface GlobalRules {
  suppression: SuppressionRule[];
}

export interface SuppressionRule {
  id: string;
  reason_zh: string;
  when: {
    type: string;
    key?: string;
    eq?: boolean;
    op?: string;
  };
  suppress: string[];
}

export interface Action {
  type: string;
  flow_id?: string;
  duration?: string;
  until?: string;
  key?: string;
  value?: unknown;
  page?: string;
}

export interface Template {
  id: string;
  trigger_id: string;
  style: string;
  locale: string;
  surfaces: {
    in_app: {
      title: string;
      body: string;
      buttons: TemplateButton[];
    };
    push?: {
      title: string;
      body: string;
      buttons: TemplateButton[];
    };
  };
}

export interface TemplateButton {
  id: string;
  label: string;
  action: string;
}

export interface Trigger {
  id: string;
  category: 'rhythm' | 'behavior' | 'protective';
  display_name_zh: string;
  enabled_by_default: boolean;
  budget_cost: {
    in_app: number;
    push: number;
  };
  template_sets: {
    fallback_style: string;
    by_style: Record<string, string[]>;
  };
  in_app: TriggerConfig;
  push?: TriggerConfig;
}

export interface TriggerConfig {
  entrypoint: string;
  delay_minutes?: {
    min: number;
    max: number;
  };
  time_window_local?: {
    start: string;
    end: string;
    day_of_week?: string;
  };
  after_hours?: number;
  constraints?: {
    once_per_local_day?: boolean;
    once_per_local_evening?: boolean;
    once_per_week?: boolean;
    once_per_session?: boolean;
    require_first_session_of_day?: boolean;
    require_push_opt_in?: boolean;
    require_user_time_window?: boolean;
    require_active_today?: boolean;
    min_hours_since_last_activity?: number;
    only_in_first_7_days_since_signup?: boolean;
    show_if_no_key_action_within_hours?: number;
    max_shows_total?: number;
    only_if_not_completed_this_week?: boolean;
    require_recently_active_days_in_last_7?: number;
    require_hours_since_last_activity_at_least?: number;
    cooldown_days?: number;
    trigger_if_session_duration_minutes_at_least?: number;
    or_if_local_time_after?: string;
    trigger_if_negative_utterances_in_window_at_least?: number;
    window_minutes?: number;
    once_per_24h?: boolean;
    same_session_only?: boolean;
    immediate?: boolean;
    bypass_frequency_budgets?: boolean;
    disabled?: boolean;
    disabled_by_default?: boolean;
  };
}

// =============================================
// 风险检测类型
// =============================================

export type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'crisis';

export interface RiskDetectionResult {
  level: RiskLevel;
  matchedKeywords: string[];
  confidence: 'low' | 'medium' | 'high';
  suggestions?: string[];
}

// =============================================
// 数据库模型类型
// =============================================

export interface UserBudgetInfo {
  user_id: string;
  frequency_level: string;
  enabled: boolean;
  push_enabled: boolean;
  dnd_start: string;
  dnd_end: string;
  style: string;
  snoozed_until: string | null;
  budget_in_app_day: number;
  budget_in_app_week: number;
  budget_push_day: number;
  budget_push_week: number;
  used_in_app_day: number;
  used_in_app_week: number;
  used_push_day: number;
  used_push_week: number;
  current_period_start: string;
  week_start: string;
}

export interface TriggerHistoryEntry {
  id: string;
  user_id: string;
  trigger_id: string;
  template_id: string;
  channel: 'in_app' | 'push';
  status: 'shown' | 'clicked' | 'dismissed';
  action_taken: string | null;
  feedback: string | null;
  created_at: string;
}

export interface CooldownEntry {
  id: string;
  user_id: string;
  trigger_id: string;
  channel: 'in_app' | 'push';
  cooldown_until: string;
  reason: string | null;
}

export interface PushTokenEntry {
  id: string;
  user_id: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  device_id: string | null;
  is_active: boolean;
  last_used_at: string | null;
}

export interface SafetyScreeningLogEntry {
  id: string;
  user_id: string;
  conversation_id: string | null;
  message_content: string | null;
  risk_level: RiskLevel;
  matched_keywords: string[] | null;
  api_response: unknown;
  created_at: string;
}

export interface UserSessionEntry {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  last_activity_at: string;
  duration_minutes: number | null;
  messages_count: number;
  timezone: string;
}

// =============================================
// API 响应类型
// =============================================

export interface CanTriggerResponse {
  allowed: boolean;
  reason?: string;
  budget_remaining?: {
    in_app_day: number;
    in_app_week: number;
    push_day?: number;
    push_week?: number;
  };
}

export interface EvaluateTriggerResponse {
  allowed: boolean;
  reason?: string;
  template?: Template;
  triggerId?: string;
  cooldownUntil?: string;
  budgetRemaining?: {
    in_app_day: number;
    in_app_week: number;
  };
}

// =============================================
// 前端设置类型
// =============================================

export interface GuanzhaoSettings {
  enabled: boolean;
  frequency_level: 'silent' | 'qingjian' | 'zhongdao' | 'jingjin';
  style: 'qingming' | 'cibei' | 'zhizhi';
  push_enabled: boolean;
  dnd_start: string;
  dnd_end: string;
}

// =============================================
// 导出所有类型
// =============================================

export type {
  GuanzhaoConfig,
  Persona,
  Defaults,
  FrequencyLevel,
  GlobalRules,
  SuppressionRule,
  Action,
  Template,
  TemplateButton,
  Trigger,
  TriggerConfig,
  RiskLevel,
  RiskDetectionResult,
  UserBudgetInfo,
  TriggerHistoryEntry,
  CooldownEntry,
  PushTokenEntry,
  SafetyScreeningLogEntry,
  UserSessionEntry,
  CanTriggerResponse,
  EvaluateTriggerResponse,
  GuanzhaoSettings,
};
