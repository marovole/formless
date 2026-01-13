/**
 * API Route: Guanzhao Trigger Evaluation
 * Evaluates whether a trigger should fire and returns the template
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getConvexClient } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import { getGuanzhaoConfig } from '@/lib/guanzhao/config';
import type { Trigger, Template, UserBudgetInfo } from '@/lib/guanzhao/types';
import type { Id } from '@/convex/_generated/dataModel';

// =============================================
// Types
// =============================================

interface EvaluateTriggerRequest {
  triggerId: string;
  channel: 'in_app' | 'push';
  userConfig?: Record<string, unknown>;
}

interface EvaluateTriggerResult {
  allowed: boolean;
  reason?: string;
  userId?: Id<'users'>;
  userSettings?: UserBudgetInfo;
}

interface TriggerHistoryItem {
  template_id: string;
}

// =============================================
// POST Handler
// =============================================

export async function POST(req: NextRequest) {
  try {
    // 1. Verify user identity (Clerk)
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json(
        { allowed: false, reason: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Parse request
    const body: EvaluateTriggerRequest = await req.json();
    const { triggerId, channel } = body;

    if (!triggerId || !channel) {
      return NextResponse.json(
        { allowed: false, reason: 'Missing triggerId or channel' },
        { status: 400 }
      );
    }

    // 3. Load configuration
    const config = getGuanzhaoConfig();
    const trigger = config.triggers.find((t: Trigger) => t.id === triggerId);

    if (!trigger) {
      return NextResponse.json(
        { allowed: false, reason: 'Trigger not found' },
        { status: 404 }
      );
    }

    const convex = getConvexClient();

    // 4. Evaluate trigger conditions in Convex (Enabled, Snoozed, DND, Cooldown)
    const evaluation = await convex.mutation(api.guanzhao.evaluateTrigger, {
      triggerId,
      channel,
      clerkId,
    }) as EvaluateTriggerResult;

    if (!evaluation.allowed) {
      return NextResponse.json(evaluation);
    }

    const { userId, userSettings } = evaluation;

    // 5. Check budget
    const budgetCost = trigger.budget_cost?.[channel] || 0;

    if (budgetCost > 0 && userSettings) {
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

    // 6. Select template
    const userStyle = userSettings?.style || 'qingming';
    const templateIds = trigger.template_sets?.by_style?.[userStyle] ||
                        trigger.template_sets?.by_style?.[trigger.template_sets?.fallback_style || 'qingming'];

    if (!templateIds || templateIds.length === 0) {
      return NextResponse.json({
        allowed: false,
        reason: 'No templates available for this trigger',
      });
    }

    // Get recently used templates (Convex Query)
    const recentHistory = await convex.query(api.guanzhao.getRecentTriggerHistory, {
      userId,
      triggerId,
      limit: templateIds.length,
    }) as TriggerHistoryItem[];

    const recentlyUsed = recentHistory.map((t: TriggerHistoryItem) => t.template_id);

    // Select an unused template
    const availableTemplateIds = templateIds.filter((id: string) => !recentlyUsed.includes(id));
    const selectedTemplateId = availableTemplateIds.length > 0
      ? availableTemplateIds[Math.floor(Math.random() * availableTemplateIds.length)]
      : templateIds[Math.floor(Math.random() * templateIds.length)];

    const template = config.templates.find((t: Template) => t.id === selectedTemplateId);

    if (!template) {
      return NextResponse.json({
        allowed: false,
        reason: 'Template not found',
      });
    }

    // 7. Consume budget and record history
    const cooldownDays = trigger[channel]?.constraints?.cooldown_days;
    await convex.mutation(api.guanzhao.recordTriggerAndConsumeBudget, {
      userId,
      triggerId,
      templateId: selectedTemplateId,
      channel,
      budgetCost,
      cooldownDays,
    });

    // 8. Return success
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
 * Check if user has sufficient budget
 */
function checkUserBudget(
  channel: 'in_app' | 'push',
  cost: number,
  settings: UserBudgetInfo
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
