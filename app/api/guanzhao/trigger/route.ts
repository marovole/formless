/**
 * API Route: Guanzhao Trigger Evaluation
 * 评估是否应该触发某个触发器，并返回模板
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getGuanzhaoConfig, getRandomTemplate, getTemplatesForTrigger } from '@/lib/guanzhao/config';
import type { GuanzhaoTemplate } from '@/components/guanzhao/GuanzhaoTriggerCard';

// =============================================
// Types
// =============================================

interface EvaluateTriggerRequest {
  triggerId: string;
  channel: 'in_app' | 'push';
  userConfig?: Record<string, unknown>;
}

// =============================================
// POST Handler
// =============================================

export async function POST(req: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await getSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { allowed: false, reason: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. 解析请求
    const body: EvaluateTriggerRequest = await req.json();
    const { triggerId, channel, userConfig } = body;

    if (!triggerId || !channel) {
      return NextResponse.json(
        { allowed: false, reason: 'Missing triggerId or channel' },
        { status: 400 }
      );
    }

    // 3. 加载配置
    const config = getGuanzhaoConfig();
    const trigger = config.triggers.find((t: any) => t.id === triggerId);

    if (!trigger) {
      return NextResponse.json(
        { allowed: false, reason: 'Trigger not found' },
        { status: 404 }
      );
    }

    // 4. 检查用户设置
    // @ts-ignore - Supabase type inference issue
    const { data: userSettings } = await supabase
      .from('guanzhao_budget_tracking')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!userSettings) {
      return NextResponse.json(
        { allowed: false, reason: 'User settings not found' },
        { status: 404 }
      );
    }

    // 5. 检查是否启用
    // @ts-ignore - Supabase type inference issue
    if (!userSettings.enabled) {
      return NextResponse.json({
        allowed: false,
        reason: 'Guanzhao is disabled',
      });
    }

    // 6. 检查静默状态
    // @ts-ignore - Supabase type inference issue
    if (userSettings.snoozed_until) {
      // @ts-ignore - Supabase type inference issue
      const snoozedUntil = new Date(userSettings.snoozed_until);
      if (snoozedUntil > new Date()) {
        return NextResponse.json({
          allowed: false,
          reason: 'User is snoozed',
          snoozedUntil: snoozedUntil.toISOString(),
        });
      }
    }

    // 7. 检查 DND（仅 push）
    if (channel === 'push') {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

      // @ts-ignore - Supabase type inference issue
      const dndStart = userSettings.dnd_start || '23:30';
      // @ts-ignore - Supabase type inference issue
      const dndEnd = userSettings.dnd_end || '08:00';

      const inDnd = isTimeInRange(currentTime, dndStart, dndEnd);
      if (inDnd) {
        return NextResponse.json({
          allowed: false,
          reason: 'User is in DND period',
        });
      }
    }

    // 8. 检查预算
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
            // @ts-ignore - Supabase type inference issue
            in_app_day: userSettings.budget_in_app_day - userSettings.used_in_app_day,
            // @ts-ignore - Supabase type inference issue
            in_app_week: userSettings.budget_in_app_week - userSettings.used_in_app_week,
          },
        });
      }
    }

    // 9. 检查冷却时间
    const cooldownCheck = await checkCooldown(supabase, user.id, triggerId, channel);
    if (cooldownCheck.inCooldown) {
      return NextResponse.json({
        allowed: false,
        reason: 'Trigger is in cooldown',
        cooldownUntil: cooldownCheck.until,
      });
    }

    // 10. 选择模板
    // @ts-ignore - Supabase type inference issue
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

    const recentlyUsed = recentTriggers?.map((t: any) => t.template_id) || [];

    // 选择一个未使用的模板
    const availableTemplateIds = templateIds.filter((id: string) => !recentlyUsed.includes(id));
    const selectedTemplateId = availableTemplateIds.length > 0
      ? availableTemplateIds[Math.floor(Math.random() * availableTemplateIds.length)]
      : templateIds[Math.floor(Math.random() * templateIds.length)];

    const template = config.templates.find((t: any) => t.id === selectedTemplateId);

    if (!template) {
      return NextResponse.json({
        allowed: false,
        reason: 'Template not found',
      });
    }

    // 11. 消耗预算
    if (budgetCost > 0) {
      await consumeBudget(supabase, user.id, channel, budgetCost);
    }

    // 12. 记录触发历史
    await supabase
      .from('guanzhao_trigger_history')
      // @ts-ignore - Supabase type inference issue
      .insert({
        user_id: user.id,
        trigger_id: triggerId,
        template_id: template.id,
        channel: channel,
        status: 'shown',
      });

    // 13. 设置冷却时间（如果有）
    const cooldownDays = trigger[channel]?.constraints?.cooldown_days;
    if (cooldownDays) {
      const cooldownUntil = new Date(Date.now() + cooldownDays * 24 * 60 * 60 * 1000);
      await supabase
        .from('guanzhao_cooldowns')
        // @ts-ignore - Supabase type inference issue
        .insert({
          user_id: user.id,
          trigger_id: triggerId,
          channel: channel,
          cooldown_until: cooldownUntil.toISOString(),
        });
    }

    // 14. 返回成功
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
  supabase: any,
  userId: string,
  channel: 'in_app' | 'push',
  cost: number,
  settings: any
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
  supabase: any,
  userId: string,
  channel: 'in_app' | 'push',
  cost: number
): Promise<void> {
  const updates: any = {};

  if (channel === 'in_app') {
    updates.used_in_app_day = supabase.rpc('increment', { amount: cost, row_id: userId });
    updates.used_in_app_week = supabase.rpc('increment', { amount: cost, row_id: userId });
  } else {
    updates.used_push_day = supabase.rpc('increment', { amount: cost, row_id: userId });
    updates.used_push_week = supabase.rpc('increment', { amount: cost, row_id: userId });
  }

  await supabase
    .from('guanzhao_budget_tracking')
    .update(updates)
    .eq('user_id', userId);
}

/**
 * 检查冷却时间
 */
async function checkCooldown(
  supabase: any,
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
