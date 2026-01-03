/**
 * API Route: Guanzhao Trigger Evaluation
 * 评估是否应该触发某个触发器，并返回模板
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getGuanzhaoConfig, type Trigger, type Template } from '@/lib/guanzhao/config';
import type { SupabaseClient } from '@supabase/supabase-js';

// =============================================
// Types
// =============================================

interface EvaluateTriggerRequest {
  triggerId: string;
  channel: 'in_app' | 'push';
}

interface UserSettings {
  enabled: boolean;
  push_enabled: boolean;
  snoozed_until: string | null;
  dnd_start: string | null;
  dnd_end: string | null;
  style: string | null;
  budget_in_app_day: number;
  budget_in_app_week: number;
  budget_push_day: number;
  budget_push_week: number;
  used_in_app_day: number;
  used_in_app_week: number;
  used_push_day: number;
  used_push_week: number;
}

// =============================================
// POST Handler
// =============================================

export async function POST(req: NextRequest) {
  try {
    // 1. 验证用户身份
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { allowed: false, reason: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. 解析请求
    const body: EvaluateTriggerRequest = await req.json();
    const { triggerId, channel } = body;

    if (!triggerId || !channel) {
      return NextResponse.json(
        { allowed: false, reason: 'Missing triggerId or channel' },
        { status: 400 }
      );
    }

    // 3. 加载配置
    const config = getGuanzhaoConfig();
    const trigger = (config.triggers as Trigger[]).find((t) => t.id === triggerId);

    if (!trigger) {
      return NextResponse.json(
        { allowed: false, reason: 'Trigger not found' },
        { status: 404 }
      );
    }

    // 4. 检查用户设置
    const { data: userSettingsData } = await supabase
      .from('guanzhao_budget_tracking')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const userSettings = userSettingsData as UserSettings | null;

    if (!userSettings) {
      return NextResponse.json(
        { allowed: false, reason: 'User settings not found' },
        { status: 404 }
      );
    }

    // 5. 检查是否启用
    if (!userSettings.enabled) {
      return NextResponse.json({
        allowed: false,
        reason: 'Guanzhao is disabled',
      });
    }

    // 6. 检查渠道是否启用（仅 push）
    if (channel === 'push' && !userSettings.push_enabled) {
      return NextResponse.json({
        allowed: false,
        reason: 'Push notifications are not enabled',
      });
    }

    // 7. 检查静默状态
    if (userSettings.snoozed_until) {
      const snoozedUntil = new Date(userSettings.snoozed_until);
      if (snoozedUntil > new Date()) {
        return NextResponse.json({
          allowed: false,
          reason: 'User is snoozed',
          snoozedUntil: snoozedUntil.toISOString(),
        });
      }
    }

    // 8. 检查 DND（仅 push）
    if (channel === 'push') {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

      const dndStart = userSettings.dnd_start || '23:30';
      const dndEnd = userSettings.dnd_end || '08:00';

      const inDnd = isTimeInRange(currentTime, dndStart, dndEnd);
      if (inDnd) {
        return NextResponse.json({
          allowed: false,
          reason: 'User is in DND period',
        });
      }
    }

    // 9. 检查预算
    const budgetCost = trigger.budget_cost?.[channel] || 0;

    if (budgetCost > 0) {
      const hasBudget = await checkUserBudget(
        supabase,
        user.id,
        channel,
        budgetCost,
        userSettings
      );

      if (!hasBudget) {
        return NextResponse.json({
          allowed: false,
          reason: 'Insufficient budget',
          budgetRemaining: {
            in_app_day: userSettings.budget_in_app_day - userSettings.used_in_app_day,
            in_app_week: userSettings.budget_in_app_week - userSettings.used_in_app_week,
          },
        });
      }
    }

    // 10. 检查冷却时间
    const cooldownCheck = await checkCooldown(supabase, user.id, triggerId, channel);
    if (cooldownCheck.inCooldown) {
      return NextResponse.json({
        allowed: false,
        reason: 'Trigger is in cooldown',
        cooldownUntil: cooldownCheck.until,
      });
    }

    // 11. 选择模板
    const userStyle = userSettings.style || 'qingming';
    const templateIds = trigger.template_sets?.by_style?.[userStyle] ||
                        trigger.template_sets?.by_style?.[trigger.template_sets?.fallback_style || 'qingming'];

    if (!templateIds || templateIds.length === 0) {
      return NextResponse.json({
        allowed: false,
        reason: 'No templates available for this trigger',
      });
    }

    // 获取最近使用的模板
    const { data: recentTriggers } = await supabase
      .from('guanzhao_trigger_history')
      .select('template_id')
      .eq('user_id', user.id)
      .eq('trigger_id', triggerId)
      .order('created_at', { ascending: false })
      .limit(templateIds.length);

    const recentlyUsed = (recentTriggers || [])
      .map((row: { template_id: string | null }) => row.template_id)
      .filter((id): id is string => Boolean(id));

    // 选择一个未使用的模板
    const availableTemplateIds = templateIds.filter((id) => !recentlyUsed.includes(id));
    const selectedTemplateId = availableTemplateIds.length > 0
      ? availableTemplateIds[Math.floor(Math.random() * availableTemplateIds.length)]
      : templateIds[Math.floor(Math.random() * templateIds.length)];

    const template = (config.templates as Template[]).find((t) => t.id === selectedTemplateId);

    if (!template) {
      return NextResponse.json({
        allowed: false,
        reason: 'Template not found',
      });
    }

    // 12. 消耗预算
    if (budgetCost > 0) {
      const consumed = await consumeBudget(supabase, user.id, channel, budgetCost, userSettings);
      if (!consumed) {
        return NextResponse.json(
          { allowed: false, reason: 'Budget changed, please retry' },
          { status: 409 }
        );
      }
    }

    // 13. 记录触发历史
    await supabase
      .from('guanzhao_trigger_history')
      .insert({
        user_id: user.id,
        trigger_id: triggerId,
        template_id: template.id,
        channel: channel,
        status: 'shown',
      });

    // 14. 设置冷却时间（如果有）
    const cooldownDays = trigger[channel]?.constraints?.cooldown_days;
    if (cooldownDays) {
      const cooldownUntil = new Date(Date.now() + cooldownDays * 24 * 60 * 60 * 1000);
      await supabase
        .from('guanzhao_cooldowns')
        .insert({
          user_id: user.id,
          trigger_id: triggerId,
          channel: channel,
          cooldown_until: cooldownUntil.toISOString(),
        });
    }

    // 15. 返回成功
    return NextResponse.json({
      allowed: true,
      triggerId: triggerId,
      template: template,
    });
  } catch (error) {
    console.error('Error evaluating trigger:', error);
    return NextResponse.json(
      { allowed: false, reason: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================
// Helper Functions
// =============================================

/**
 * 检查时间是否在范围内（支持跨午夜）
 */
function isTimeInRange(currentTime: string, startTime: string, endTime: string): boolean {
  const current = parseTime(currentTime);
  const start = parseTime(startTime);
  const end = parseTime(endTime);

  if (start < end) {
    // 同一天内
    return current >= start && current < end;
  } else {
    // 跨午夜，如 23:30 到 08:00
    return current >= start || current < end;
  }
}

/**
 * 解析时间字符串为分钟数
 */
function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * 检查用户是否有足够预算
 */
async function checkUserBudget(
  _supabase: SupabaseClient,
  userId: string,
  channel: 'in_app' | 'push',
  cost: number,
  settings: UserSettings
): Promise<boolean> {
  if (cost === 0) return true;

  if (channel === 'in_app') {
    const dayRemaining = settings.budget_in_app_day - settings.used_in_app_day;
    const weekRemaining = settings.budget_in_app_week - settings.used_in_app_week;

    return cost <= dayRemaining && cost <= weekRemaining;
  } else {
    const dayRemaining = settings.budget_push_day - settings.used_push_day;
    const weekRemaining = settings.budget_push_week - settings.used_push_week;

    return cost <= dayRemaining && cost <= weekRemaining;
  }
}

/**
 * 消耗预算
 */
async function consumeBudget(
  supabase: SupabaseClient,
  userId: string,
  channel: 'in_app' | 'push',
  cost: number,
  settings: UserSettings
): Promise<boolean> {
  const updates: Partial<Pick<UserSettings,
    'used_in_app_day' | 'used_in_app_week' | 'used_push_day' | 'used_push_week'
  >> = {};
  let query = supabase.from('guanzhao_budget_tracking').update(updates).eq('user_id', userId);

  if (channel === 'in_app') {
    updates.used_in_app_day = settings.used_in_app_day + cost;
    updates.used_in_app_week = settings.used_in_app_week + cost;
    query = query
      .eq('used_in_app_day', settings.used_in_app_day)
      .eq('used_in_app_week', settings.used_in_app_week);
  } else {
    updates.used_push_day = settings.used_push_day + cost;
    updates.used_push_week = settings.used_push_week + cost;
    query = query
      .eq('used_push_day', settings.used_push_day)
      .eq('used_push_week', settings.used_push_week);
  }

  const { data, error } = await query.select('user_id').maybeSingle();

  if (error) {
    console.error('Failed to consume budget:', error);
    return false;
  }

  return !!data;
}

/**
 * 检查冷却时间
 */
async function checkCooldown(
  supabase: SupabaseClient,
  userId: string,
  triggerId: string,
  channel: 'in_app' | 'push'
): Promise<{ inCooldown: boolean; until?: string }> {
  const { data } = await supabase
    .from('guanzhao_cooldowns')
    .select('*')
    .eq('user_id', userId)
    .eq('trigger_id', triggerId)
    .eq('channel', channel)
    .gte('cooldown_until', new Date().toISOString())
    .maybeSingle();

  if (data) {
    return { inCooldown: true, until: data.cooldown_until };
  }

  return { inCooldown: false };
}
