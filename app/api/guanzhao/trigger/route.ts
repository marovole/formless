/**
 * API Route: Guanzhao Trigger Evaluation
 * 评估是否应该触发某个触发器，并返回模板
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getConvexClient } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import { getGuanzhaoConfig } from '@/lib/guanzhao/config';

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
    // 1. 验证用户身份 (Clerk)
    const { userId: clerkId } = await auth();

    if (!clerkId) {
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
    const trigger = config.triggers.find((t: any) => t.id === triggerId);

    if (!trigger) {
      return NextResponse.json(
        { allowed: false, reason: 'Trigger not found' },
        { status: 404 }
      );
    }

    const convex = getConvexClient();

    // 4. 在 Convex 中评估触发条件 (Enabled, Snoozed, DND, Cooldown)
    // 注意：Convex Mutation 在 HTTP Client 中通过 mutation 调用
    const evaluation: any = await convex.mutation(api.guanzhao.evaluateTrigger, {
      triggerId,
      channel,
      clerkId,
    });

    if (!evaluation.allowed) {
      return NextResponse.json(evaluation);
    }

    const { userId, userSettings } = evaluation;

    // 5. 检查预算
    const budgetCost = trigger.budget_cost?.[channel] || 0;

    if (budgetCost > 0) {
      const hasBudget = checkUserBudget(channel, budgetCost, userSettings);

      if (!hasBudget) {
        return NextResponse.json({
          allowed: false,
          reason: 'Insufficient budget',
          budgetRemaining: {
            in_app_day: (userSettings.budget_in_app_day || 0) - (userSettings.used_in_app_day || 0),
            in_app_week: (userSettings.budget_in_app_week || 0) - (userSettings.used_in_app_week || 0),
          },
        });
      }
    }

    // 6. 选择模板
    const userStyle = userSettings.style || 'qingming';
    const templateIds = trigger.template_sets?.by_style?.[userStyle] ||
                        trigger.template_sets?.by_style?.[trigger.template_sets?.fallback_style || 'qingming'];

    if (!templateIds || templateIds.length === 0) {
      return NextResponse.json({
        allowed: false,
        reason: 'No templates available for this trigger',
      });
    }

    // 获取最近使用的模板 (Convex Query)
    const recentHistory = await convex.query(api.guanzhao.getRecentTriggerHistory, {
      userId,
      triggerId,
      limit: templateIds.length,
    });

    const recentlyUsed = recentHistory.map((t: any) => t.template_id);

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

    // 7. 消耗预算并记录历史
    const cooldownDays = trigger[channel]?.constraints?.cooldown_days;
    await convex.mutation(api.guanzhao.recordTriggerAndConsumeBudget, {
      userId,
      triggerId,
      templateId: selectedTemplateId,
      channel,
      budgetCost,
      cooldownDays,
    });

    // 8. 返回成功
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
 * 检查用户是否有足够预算
 */
function checkUserBudget(
  channel: 'in_app' | 'push',
  cost: number,
  settings: any
): boolean {
  if (cost === 0) return true;

  if (channel === 'in_app') {
    const dayRemaining = (settings.budget_in_app_day || 0) - (settings.used_in_app_day || 0);
    const weekRemaining = (settings.budget_in_app_week || 0) - (settings.used_in_app_week || 0);

    return cost <= dayRemaining && cost <= weekRemaining;
  } else {
    const dayRemaining = (settings.budget_push_day || 0) - (settings.used_push_day || 0);
    const weekRemaining = (settings.budget_push_week || 0) - (settings.used_push_week || 0);

    return cost <= dayRemaining && cost <= weekRemaining;
  }
}
