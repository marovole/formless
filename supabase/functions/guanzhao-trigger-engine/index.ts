/**
 * Supabase Edge Function: Trigger Engine
 * 触发器评估引擎 - 检查是否应该触发某个触发器并返回模板
 *
 * 功能：
 * - 检查触发器约束条件
 * - 检查预算和冷却时间
 * - 选择合适的模板
 * - 消耗预算并记录触发
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// =============================================
// Types
// =============================================

interface EvaluateTriggerRequest {
  userId: string;
  triggerId: string;
  channel: 'in_app' | 'push';
  userConfig?: Record<string, any>;
  context?: {
    sessionId?: string;
    conversationId?: string;
    [key: string]: any;
  };
}

interface Template {
  id: string;
  trigger_id: string;
  style: string;
  locale: string;
  surfaces: {
    in_app: {
      title: string;
      body: string;
      buttons: Array<{
        id: string;
        label: string;
        action: string;
      }>;
    };
    push?: {
      title: string;
      body: string;
      buttons: Array<{
        id: string;
        label: string;
        action: string;
      }>;
    };
  };
}

interface EvaluateTriggerResponse {
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
// Configuration (loaded from docs/guanzhao/guanzhao-bundle.json)
// =============================================

let guanzhaoConfig: any = null;

async function loadConfig() {
  if (guanzhaoConfig) return guanzhaoConfig;

  // 在实际部署中，这应该从 Supabase Storage 或环境变量加载
  // 这里为了演示，我们返回一个基本的配置结构
  guanzhaoConfig = {
    triggers: [], // 实际应该从 JSON 文件加载
    templates: [],
    actions: {},
    frequency_levels: {},
  };

  return guanzhaoConfig;
}

// =============================================
// Supabase Client
// =============================================

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// =============================================
// Budget Management
// =============================================

/**
 * 检查用户是否有足够预算
 */
async function checkBudget(
  userId: string,
  channel: 'in_app' | 'push',
  cost: number
): Promise<{ allowed: boolean; remaining?: any }> {
  const { data: budget } = await supabase
    .from('guanzhao_budget_tracking')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!budget) {
    return { allowed: false };
  }

  if (channel === 'in_app') {
    const dayRemaining = budget.budget_in_app_day - budget.used_in_app_day;
    const weekRemaining = budget.budget_in_app_week - budget.used_in_app_week;

    if (cost > dayRemaining || cost > weekRemaining) {
      return {
        allowed: false,
        remaining: {
          in_app_day: dayRemaining,
          in_app_week: weekRemaining,
        },
      };
    }
  } else {
    const dayRemaining = budget.budget_push_day - budget.used_push_day;
    const weekRemaining = budget.budget_push_week - budget.used_push_week;

    if (cost > dayRemaining || cost > weekRemaining) {
      return { allowed: false };
    }
  }

  return { allowed: true };
}

/**
 * 消耗预算
 */
async function consumeBudget(
  userId: string,
  channel: 'in_app' | 'push',
  cost: number
): Promise<boolean> {
  const updates: any = {};

  if (channel === 'in_app') {
    updates.used_in_app_day = supabase.rpc('increment', { amount: cost });
    updates.used_in_app_week = supabase.rpc('increment', { amount: cost });
  } else {
    updates.used_push_day = supabase.rpc('increment', { amount: cost });
    updates.used_push_week = supabase.rpc('increment', { amount: cost });
  }

  const { error } = await supabase
    .from('guanzhao_budget_tracking')
    .update(updates)
    .eq('user_id', userId);

  return !error;
}

// =============================================
// Cooldown Management
// =============================================

/**
 * 检查是否在冷却期
 */
async function checkCooldown(
  userId: string,
  triggerId: string,
  channel: 'in_app' | 'push'
): Promise<{ inCooldown: boolean; until?: string }> {
  const { data: cooldown } = await supabase
    .from('guanzhao_cooldowns')
    .select('*')
    .eq('user_id', userId)
    .eq('trigger_id', triggerId)
    .eq('channel', channel)
    .gte('cooldown_until', new Date().toISOString())
    .maybeSingle();

  if (cooldown) {
    return { inCooldown: true, until: cooldown.cooldown_until };
  }

  return { inCooldown: false };
}

// =============================================
// Suppression Checks
// =============================================

/**
 * 检查全局抑制规则
 */
async function checkSuppressionRules(
  userId: string,
  channel: 'in_app' | 'push'
): Promise<{ suppressed: boolean; reason?: string }> {
  // 1. 检查用户是否禁用观照
  const { data: budget } = await supabase
    .from('guanzhao_budget_tracking')
    .select('enabled, snoozed_until')
    .eq('user_id', userId)
    .single();

  if (!budget || !budget.enabled) {
    return { suppressed: true, reason: 'Guanzhao is disabled' };
  }

  // 2. 检查静默状态
  if (budget.snoozed_until) {
    const snoozedUntil = new Date(budget.snoozed_until);
    if (snoozedUntil > new Date()) {
      return { suppressed: true, reason: 'User is snoozed' };
    }
  }

  // 3. 检查 DND 时段（仅 push）
  if (channel === 'push') {
    const { data: inDnd } = await supabase
      .rpc('is_user_in_dnd', { user_id: userId });

    if (inDnd) {
      return { suppressed: true, reason: 'User is in DND period' };
    }
  }

  return { suppressed: false };
}

// =============================================
// Template Selection
// =============================================

/**
 * 选择模板
 */
async function selectTemplate(
  userId: string,
  triggerId: string,
  style: string
): Promise<Template | null> {
  // 1. 获取最近使用的模板
  const { data: recentTriggers } = await supabase
    .from('guanzhao_trigger_history')
    .select('template_id')
    .eq('user_id', userId)
    .eq('trigger_id', triggerId)
    .order('created_at', { ascending: false })
    .limit(5);

  const recentlyUsed = recentTriggers?.map((t) => t.template_id) || [];

  // 2. 获取触发器的所有模板
  // 实际实现中应该从配置文件加载
  // 这里返回一个示例模板
  const template: Template = {
    id: `guanzhao.${triggerId}.${style}.1`,
    trigger_id: triggerId,
    style: style,
    locale: 'zh-CN',
    surfaces: {
      in_app: {
        title: '示例标题',
        body: '这是示例内容。实际实现中应该从配置文件加载。',
        buttons: [
          { id: 'primary', label: '确认', action: 'open_flow.example' },
          { id: 'dismiss', label: '关闭', action: 'snooze.today' },
        ],
      },
    },
  };

  return template;
}

// =============================================
// Trigger Recording
// =============================================

/**
 * 记录触发历史
 */
async function recordTrigger(
  userId: string,
  triggerId: string,
  templateId: string,
  channel: 'in_app' | 'push'
): Promise<string | null> {
  const { data, error } = await supabase
    .from('guanzhao_trigger_history')
    .insert({
      user_id: userId,
      trigger_id: triggerId,
      template_id: templateId,
      channel: channel,
      status: 'shown',
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error recording trigger:', error);
    return null;
  }

  return data.id;
}

// =============================================
// Main Handler
// =============================================

serve(async (req) => {
  // CORS 处理
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // 解析请求
    const body: EvaluateTriggerRequest = await req.json();
    const { userId, triggerId, channel, userConfig, context } = body;

    // 1. 加载配置
    await loadConfig();

    // 2. 检查抑制规则
    const suppressionCheck = await checkSuppressionRules(userId, channel);
    if (suppressionCheck.suppressed) {
      return new Response(
        JSON.stringify({
          allowed: false,
          reason: suppressionCheck.reason,
        } as EvaluateTriggerResponse),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    // 3. 检查冷却时间
    const cooldownCheck = await checkCooldown(userId, triggerId, channel);
    if (cooldownCheck.inCooldown) {
      return new Response(
        JSON.stringify({
          allowed: false,
          reason: 'Trigger is in cooldown',
          cooldownUntil: cooldownCheck.until,
        } as EvaluateTriggerResponse),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    // 4. 检查预算
    // 获取触发器预算消耗（这里假设为 1，实际应该从配置读取）
    const budgetCost = 1;
    const budgetCheck = await checkBudget(userId, channel, budgetCost);
    if (!budgetCheck.allowed) {
      return new Response(
        JSON.stringify({
          allowed: false,
          reason: 'Insufficient budget',
          budgetRemaining: budgetCheck.remaining,
        } as EvaluateTriggerResponse),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    // 5. 选择模板
    // 获取用户风格设置
    const { data: budget } = await supabase
      .from('guanzhao_budget_tracking')
      .select('style')
      .eq('user_id', userId)
      .single();

    const userStyle = budget?.style || 'qingming';
    const template = await selectTemplate(userId, triggerId, userStyle);

    if (!template) {
      return new Response(
        JSON.stringify({
          allowed: false,
          reason: 'No template available',
        } as EvaluateTriggerResponse),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    // 6. 消耗预算
    const consumed = await consumeBudget(userId, channel, budgetCost);
    if (!consumed) {
      return new Response(
        JSON.stringify({
          allowed: false,
          reason: 'Failed to consume budget',
        } as EvaluateTriggerResponse),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    // 7. 记录触发
    await recordTrigger(userId, triggerId, template.id, channel);

    // 8. 返回成功响应
    return new Response(
      JSON.stringify({
        allowed: true,
        template: template,
        triggerId: triggerId,
      } as EvaluateTriggerResponse),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  } catch (error) {
    console.error('Error in trigger-engine:', error);
    return new Response(
      JSON.stringify({
        allowed: false,
        reason: 'Internal server error',
      } as EvaluateTriggerResponse),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
});
