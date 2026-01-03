/**
 * 观照（Guanzhao）预算管理系统
 * 处理频率控制、预算消耗、冷却时间和抑制规则
 */

import { createClient } from '@/lib/supabase/client';
import {
  getTriggerBudgetCost,
  getBudgetForFrequencyLevel,
  resolveTimeWindow,
} from './config';
import type { Trigger } from './types';

// =============================================
// Type Definitions
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
  // 预算
  budget_in_app_day: number;
  budget_in_app_week: number;
  budget_push_day: number;
  budget_push_week: number;
  // 已使用
  used_in_app_day: number;
  used_in_app_week: number;
  used_push_day: number;
  used_push_week: number;
  // 周期
  current_period_start: string;
  week_start: string;
}

export interface CanTriggerResult {
  allowed: boolean;
  reason?: string;
  budget_remaining?: {
    in_app_day: number;
    in_app_week: number;
    push_day?: number;
    push_week?: number;
  };
}

export interface ConsumeBudgetResult {
  success: boolean;
  message?: string;
  remaining?: {
    in_app_day: number;
    in_app_week: number;
  };
}

// =============================================
// Supabase Client
// =============================================

function getSupabaseClient() {
  return createClient();
}

// =============================================
// Budget Queries
// =============================================

/**
 * 获取用户预算信息
 */
export async function getUserBudgetInfo(userId: string): Promise<UserBudgetInfo | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('guanzhao_budget_tracking')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error fetching user budget info:', error);
    return null;
  }

  return data as UserBudgetInfo;
}

/**
 * 创建或初始化用户预算信息
 */
export async function initializeUserBudget(userId: string): Promise<UserBudgetInfo | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('guanzhao_budget_tracking')
    // @ts-ignore - Supabase type inference issue
    .upsert({
      user_id: userId,
      // 默认值
      frequency_level: 'qingjian',
      enabled: true,
      push_enabled: false,
      dnd_start: '23:30',
      dnd_end: '08:00',
      style: 'qingming',
    })
    .select()
    .single();

  if (error) {
    console.error('Error initializing user budget:', error);
    return null;
  }

  return data as UserBudgetInfo;
}

/**
 * 更新用户预算设置
 */
export async function updateUserBudgetSettings(
  userId: string,
  settings: Partial<{
    frequency_level: string;
    enabled: boolean;
    push_enabled: boolean;
    dnd_start: string;
    dnd_end: string;
    style: string;
  }>
): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('guanzhao_budget_tracking')
    // @ts-ignore - Supabase type inference issue
    .update(settings)
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating user budget settings:', error);
    return false;
  }

  return true;
}

/**
 * 设置静默状态
 */
export async function setSnooze(
  userId: string,
  duration?: '24h' | '7d' | 'today',
  until?: Date
): Promise<boolean> {
  const supabase = getSupabaseClient();

  let snoozedUntil: Date;

  if (until) {
    snoozedUntil = until;
  } else if (duration === '24h') {
    snoozedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
  } else if (duration === '7d') {
    snoozedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  } else if (duration === 'today') {
    // 到今天结束
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    snoozedUntil = tomorrow;
  } else {
    return false;
  }

  const { error } = await supabase
    .from('guanzhao_budget_tracking')
    // @ts-ignore - Supabase type inference issue
    .update({ snoozed_until: snoozedUntil.toISOString() })
    .eq('user_id', userId);

  if (error) {
    console.error('Error setting snooze:', error);
    return false;
  }

  return true;
}

// =============================================
// Trigger Permission Checks
// =============================================

/**
 * 检查是否可以触发（完整检查）
 */
export async function canTrigger(
  userId: string,
  triggerId: string,
  channel: 'in_app' | 'push',
  userConfig?: Record<string, any>
): Promise<CanTriggerResult> {
  // 1. 获取用户预算信息
  let budgetInfo = await getUserBudgetInfo(userId);

  if (!budgetInfo) {
    budgetInfo = await initializeUserBudget(userId);
    if (!budgetInfo) {
      return { allowed: false, reason: 'Failed to initialize user budget' };
    }
  }

  // 2. 检查用户是否禁用观照
  if (!budgetInfo.enabled) {
    return { allowed: false, reason: 'Guanzhao is disabled by user' };
  }

  // 3. 检查静默状态
  if (budgetInfo.snoozed_until) {
    const snoozedUntil = new Date(budgetInfo.snoozed_until);
    if (snoozedUntil > new Date()) {
      return {
        allowed: false,
        reason: `User is snoozed until ${snoozedUntil.toLocaleString()}`,
      };
    }
  }

  // 4. 检查 DND 时段（仅针对 push）
  if (channel === 'push') {
    const inDnd = await isInDndPeriod(userId);
    if (inDnd) {
      return { allowed: false, reason: 'User is in DND period' };
    }
  }

  // 5. 检查冷却时间
  const inCooldown = await isInCooldown(userId, triggerId, channel);
  if (inCooldown) {
    return { allowed: false, reason: 'Trigger is in cooldown period' };
  }

  // 6. 检查预算
  const budgetCost = getTriggerBudgetCost(triggerId, channel);
  if (budgetCost > 0) {
    const hasBudget = await hasSufficientBudget(userId, channel, budgetCost);
    if (!hasBudget) {
      return {
        allowed: false,
        reason: `Insufficient budget (cost: ${budgetCost})`,
        budget_remaining: await getRemainingBudget(userId),
      };
    }
  }

  // 7. 检查渠道是否启用
  if (channel === 'push' && !budgetInfo.push_enabled) {
    return { allowed: false, reason: 'Push notifications are not enabled' };
  }

  return {
    allowed: true,
    budget_remaining: await getRemainingBudget(userId),
  };
}

/**
 * 检查是否在 DND 时段
 */
async function isInDndPeriod(userId: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    // @ts-ignore - Supabase type inference issue
    .rpc('is_user_in_dnd', { user_id: userId });

  if (error) {
    console.error('Error checking DND:', error);
    return false;
  }

  return data || false;
}

/**
 * 检查是否在冷却期
 */
async function isInCooldown(
  userId: string,
  triggerId: string,
  channel: 'in_app' | 'push'
): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('guanzhao_cooldowns')
    .select('*')
    .eq('user_id', userId)
    .eq('trigger_id', triggerId)
    .eq('channel', channel)
    .gte('cooldown_until', new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error('Error checking cooldown:', error);
    return false;
  }

  return !!data;
}

/**
 * 检查是否有足够预算
 */
async function hasSufficientBudget(
  userId: string,
  channel: 'in_app' | 'push',
  cost: number
): Promise<boolean> {
  const supabase = getSupabaseClient();
  const budgetInfo = await getUserBudgetInfo(userId);

  if (!budgetInfo) return false;

  if (channel === 'in_app') {
    const dayKey = 'used_in_app_day' as const;
    const weekKey = 'used_in_app_week' as const;
    const budgetDayKey = 'budget_in_app_day' as const;
    const budgetWeekKey = 'budget_in_app_week' as const;

    return (
      (budgetInfo[dayKey] + cost) <= budgetInfo[budgetDayKey] &&
      (budgetInfo[weekKey] + cost) <= budgetInfo[budgetWeekKey]
    );
  } else {
    const dayKey = 'used_push_day' as const;
    const weekKey = 'used_push_week' as const;
    const budgetDayKey = 'budget_push_day' as const;
    const budgetWeekKey = 'budget_push_week' as const;

    return (
      (budgetInfo[dayKey] + cost) <= budgetInfo[budgetDayKey] &&
      (budgetInfo[weekKey] + cost) <= budgetInfo[budgetWeekKey]
    );
  }
}

/**
 * 获取剩余预算
 */
async function getRemainingBudget(
  userId: string
): Promise<{
  in_app_day: number;
  in_app_week: number;
  push_day?: number;
  push_week?: number;
}> {
  const budgetInfo = await getUserBudgetInfo(userId);

  if (!budgetInfo) {
    return { in_app_day: 0, in_app_week: 0 };
  }

  return {
    in_app_day: budgetInfo.budget_in_app_day - budgetInfo.used_in_app_day,
    in_app_week: budgetInfo.budget_in_app_week - budgetInfo.used_in_app_week,
    push_day: budgetInfo.budget_push_day - budgetInfo.used_push_day,
    push_week: budgetInfo.budget_push_week - budgetInfo.used_push_week,
  };
}

// =============================================
// Budget Consumption
// =============================================

/**
 * 消耗预算
 */
export async function consumeBudget(
  userId: string,
  triggerId: string,
  channel: 'in_app' | 'push'
): Promise<ConsumeBudgetResult> {
  const supabase = getSupabaseClient();
  const cost = getTriggerBudgetCost(triggerId, channel);

  if (cost === 0) {
    return { success: true };
  }

  const budgetInfo = await getUserBudgetInfo(userId);
  if (!budgetInfo) {
    return { success: false, message: 'User budget info not found' };
  }

  const updates: Record<string, number> = {};

  if (channel === 'in_app') {
    updates.used_in_app_day = budgetInfo.used_in_app_day + cost;
    updates.used_in_app_week = budgetInfo.used_in_app_week + cost;
  } else {
    updates.used_push_day = budgetInfo.used_push_day + cost;
    updates.used_push_week = budgetInfo.used_push_week + cost;
  }

  const { error } = await supabase
    .from('guanzhao_budget_tracking')
    // @ts-ignore - Supabase type inference issue
    .update(updates)
    .eq('user_id', userId);

  if (error) {
    console.error('Error consuming budget:', error);
    return { success: false, message: error.message };
  }

  const remaining = await getRemainingBudget(userId);

  return {
    success: true,
    remaining: {
      in_app_day: remaining.in_app_day,
      in_app_week: remaining.in_app_week,
    },
  };
}

// =============================================
// Cooldown Management
// =============================================

/**
 * 设置冷却时间
 */
export async function setCooldown(
  userId: string,
  triggerId: string,
  channel: 'in_app' | 'push',
  cooldownHours?: number,
  reason?: string
): Promise<boolean> {
  const supabase = getSupabaseClient();

  let cooldownUntil: Date;

  if (cooldownHours) {
    cooldownUntil = new Date(Date.now() + cooldownHours * 60 * 60 * 1000);
  } else {
    // 从触发器配置获取冷却时间
    const trigger = (await import('./config')).getTriggerConfig(triggerId);
    if (!trigger) return false;

    const cooldownDays = trigger[channel]?.constraints?.cooldown_days;
    if (!cooldownDays) return true; // 无冷却时间

    cooldownUntil = new Date(Date.now() + cooldownDays * 24 * 60 * 60 * 1000);
  }

  const { error } = await supabase
    .from('guanzhao_cooldowns')
    // @ts-ignore - Supabase type inference issue
    .insert({
      user_id: userId,
      trigger_id: triggerId,
      channel: channel,
      cooldown_until: cooldownUntil.toISOString(),
      reason: reason || `Trigger cooldown after ${triggerId}`,
    });

  if (error) {
    console.error('Error setting cooldown:', error);
    return false;
  }

  return true;
}

/**
 * 清除冷却时间
 */
export async function clearCooldown(
  userId: string,
  triggerId: string,
  channel: 'in_app' | 'push'
): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('guanzhao_cooldowns')
    .delete()
    .eq('user_id', userId)
    .eq('trigger_id', triggerId)
    .eq('channel', channel);

  if (error) {
    console.error('Error clearing cooldown:', error);
    return false;
  }

  return true;
}

// =============================================
// Trigger History
// =============================================

/**
 * 记录触发历史
 */
export async function recordTrigger(
  userId: string,
  triggerId: string,
  templateId: string,
  channel: 'in_app' | 'push',
  status: 'shown' | 'clicked' | 'dismissed' = 'shown'
): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('guanzhao_trigger_history')
    // @ts-ignore - Supabase type inference issue
    .insert({
      user_id: userId,
      trigger_id: triggerId,
      template_id: templateId,
      channel: channel,
      status: status,
    });

  if (error) {
    console.error('Error recording trigger:', error);
    return false;
  }

  return true;
}

/**
 * 记录用户动作
 */
export async function recordAction(
  userId: string,
  triggerHistoryId: string,
  action: string
): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('guanzhao_trigger_history')
    // @ts-ignore - Supabase type inference issue
    .update({
      action_taken: action,
      status: 'clicked',
    })
    .eq('id', triggerHistoryId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error recording action:', error);
    return false;
  }

  return true;
}

/**
 * 记录用户反馈
 */
export async function recordFeedback(
  userId: string,
  triggerHistoryId: string,
  feedback: 'useful' | 'not_fit' | 'too_frequent' | 'not_relevant'
): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('guanzhao_trigger_history')
    // @ts-ignore - Supabase type inference issue
    .update({ feedback })
    .eq('id', triggerHistoryId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error recording feedback:', error);
    return false;
  }

  // 如果反馈是"too_frequent"，考虑调整频率级别
  if (feedback === 'too_frequent') {
    await handleTooFrequentFeedback(userId);
  }

  return true;
}

/**
 * 处理"太频繁"反馈
 */
async function handleTooFrequentFeedback(userId: string): Promise<void> {
  const budgetInfo = await getUserBudgetInfo(userId);
  if (!budgetInfo) return;

  // 降级频率级别
  const levels = ['jingjin', 'zhongdao', 'qingjian', 'silent'];
  const currentIndex = levels.indexOf(budgetInfo.frequency_level);

  if (currentIndex < levels.length - 1) {
    const newLevel = levels[currentIndex + 1];
    await updateUserBudgetSettings(userId, { frequency_level: newLevel });
  }
}

/**
 * 获取最近使用的模板
 */
export async function getRecentlyUsedTemplates(
  userId: string,
  triggerId: string,
  limit: number = 5
): Promise<string[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    // @ts-ignore - Supabase type inference issue
    .from('guanzhao_trigger_history')
    // @ts-ignore - Supabase type inference issue
    .select('template_id')
    .eq('user_id', userId)
    .eq('trigger_id', triggerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  // @ts-ignore - Supabase type inference issue
  return data.map((d) => d.template_id).filter(Boolean) as string[];
}

/**
 * 获取触发统计
 */
export async function getTriggerStats(
  userId: string,
  triggerId: string
): Promise<{
  today: number;
  week: number;
  total: number;
  clicked: number;
  dismissed: number;
} | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('guanzhao_trigger_history')
    .select('*')
    .eq('user_id', userId)
    .eq('trigger_id', triggerId);

  if (error || !data) {
    return null;
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // @ts-ignore - Supabase type inference issue
  const today = data.filter(
    // @ts-ignore - Supabase type inference issue
    (d) => new Date(d.created_at) >= todayStart
  ).length;

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  // @ts-ignore - Supabase type inference issue
  const week = data.filter((d) => new Date(d.created_at) >= weekStart).length;
  // @ts-ignore - Supabase type inference issue
  const clicked = data.filter((d) => d.status === 'clicked').length;
  // @ts-ignore - Supabase type inference issue
  const dismissed = data.filter((d) => d.status === 'dismissed').length;

  return {
    today,
    week,
    total: data.length,
    clicked,
    dismissed,
  };
}

// =============================================
// Utility Functions
// =============================================

/**
 * 重置用户预算（通常由定时任务调用）
 */
export async function resetUserBudget(userId: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('guanzhao_budget_tracking')
    // @ts-ignore - Supabase type inference issue
    .update({
      used_in_app_day: 0,
      used_push_day: 0,
      current_period_start: new Date().toISOString().split('T')[0],
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Error resetting user budget:', error);
    return false;
  }

  return true;
}

/**
 * 重置周预算（通常由定时任务调用）
 */
export async function resetWeekBudget(userId: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const { error } = await supabase
    .from('guanzhao_budget_tracking')
    // @ts-ignore - Supabase type inference issue
    .update({
      used_in_app_week: 0,
      used_push_week: 0,
      week_start: weekStart.toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Error resetting week budget:', error);
    return false;
  }

  return true;
}
