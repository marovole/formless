import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { GUANZHAO_DURATIONS } from "./constants";
import { ActionResponse } from "./types";
import { upsertBudgetTracking } from "./budget";

// ============================================================================
// Action Handlers for Guanzhao (Mindfulness) System
// ============================================================================

export async function handleSnoozeAction(
  ctx: MutationCtx,
  userId: Id<'users'>,
  action: string
): Promise<ActionResponse> {
  let snoozedUntil: Date;

  if (action === 'snooze.24h') {
    snoozedUntil = new Date(Date.now() + GUANZHAO_DURATIONS.SNOOZE_24H);
  } else if (action === 'snooze.7d') {
    snoozedUntil = new Date(Date.now() + GUANZHAO_DURATIONS.SNOOZE_7D);
  } else if (action === 'snooze.today') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    snoozedUntil = tomorrow;
  } else {
    return { error: 'Unknown snooze action' };
  }

  await upsertBudgetTracking(ctx, userId, { snoozed_until: snoozedUntil.toISOString() });
  return { success: true, message: `Snoozed until ${snoozedUntil.toLocaleString()}` };
}

export async function handleDisableAction(
  ctx: MutationCtx,
  userId: Id<'users'>
): Promise<ActionResponse> {
  await upsertBudgetTracking(ctx, userId, { enabled: false });
  return { success: true, message: 'Guanzhao disabled' };
}

export async function handleKeepWeeklyOnlyAction(
  ctx: MutationCtx,
  userId: Id<'users'>
): Promise<ActionResponse> {
  await upsertBudgetTracking(ctx, userId, { frequency_level: 'silent', push_enabled: false });
  return { success: true, message: 'Switched to weekly review only mode' };
}

export async function handleFeedbackAction(
  ctx: MutationCtx,
  userId: Id<'users'>,
  action: string,
  triggerHistoryId?: string
): Promise<ActionResponse> {
  if (!triggerHistoryId) return { error: 'Missing triggerHistoryId' };

  const feedback = action.replace('feedback.', '');
  await ctx.db.patch(triggerHistoryId as Id<"guanzhao_trigger_history">, { feedback });

  // Auto-downgrade frequency if user complains about frequency
  if (feedback === 'too_frequent') {
    const budget = await ctx.db.query("guanzhao_budget_tracking")
      .withIndex("by_user_id", q => q.eq("user_id", userId))
      .first();

    if (budget && budget.frequency_level) {
      const idx = ['jingjin', 'zhongdao', 'qingjian', 'silent'].indexOf(budget.frequency_level as string);
      if (idx >= 0 && idx < 3) {
        await ctx.db.patch(budget._id, { frequency_level: ['jingjin', 'zhongdao', 'qingjian', 'silent'][idx + 1] });
      }
    }
  }

  return { success: true, message: 'Thanks for your feedback' };
}

export function handleSafetyAction(action: string): ActionResponse {
  if (action === 'safety.open_resources') return { redirectUrl: '/resources/crisis' };
  if (action === 'safety.confirm_safe') return { success: true, message: 'Recorded' };
  return { error: 'Unknown safety action' };
}