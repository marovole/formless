import { MutationCtx } from '../_generated/server';
import { Id } from '../_generated/dataModel';
import { GUANZHAO_DURATIONS, FREQUENCY_LEVELS } from './constants';
import { ActionResponse } from './types';
import { upsertBudgetTracking } from './budget';

// ============================================================================
// Snooze Action Strategy Pattern
// ============================================================================

type SnoozeStrategy = () => Date;

/**
 * 获取明天午夜时间
 */
function getTomorrowMidnight(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

/**
 * 暂停策略映射表
 * 消除 if-else 链，使用策略模式
 */
const SNOOZE_STRATEGIES: Record<string, SnoozeStrategy> = {
  'snooze.24h': () => new Date(Date.now() + GUANZHAO_DURATIONS.SNOOZE_24H),
  'snooze.7d': () => new Date(Date.now() + GUANZHAO_DURATIONS.SNOOZE_7D),
  'snooze.today': getTomorrowMidnight,
};

export async function handleSnoozeAction(
  ctx: MutationCtx,
  userId: Id<'users'>,
  action: string
): Promise<ActionResponse> {
  const strategy = SNOOZE_STRATEGIES[action];

  if (!strategy) {
    return { error: 'Unknown snooze action' };
  }

  const snoozedUntil = strategy();
  await upsertBudgetTracking(ctx, userId, { snoozed_until: snoozedUntil.toISOString() });

  return { success: true, message: `Snoozed until ${snoozedUntil.toLocaleString()}` };
}

// ============================================================================
// Other Action Handlers
// ============================================================================

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

// ============================================================================
// Feedback Action with Auto-downgrade
// ============================================================================

/**
 * 获取降级后的频率级别
 * 如果当前级别不是最后一个，则返回下一个级别
 */
function getDowngradedFrequency(currentLevel: string): string | null {
  const idx = FREQUENCY_LEVELS.indexOf(currentLevel as typeof FREQUENCY_LEVELS[number]);
  if (idx >= 0 && idx < FREQUENCY_LEVELS.length - 1) {
    return FREQUENCY_LEVELS[idx + 1];
  }
  return null;
}

export async function handleFeedbackAction(
  ctx: MutationCtx,
  userId: Id<'users'>,
  action: string,
  triggerHistoryId?: string
): Promise<ActionResponse> {
  if (!triggerHistoryId) return { error: 'Missing triggerHistoryId' };

  const feedback = action.replace('feedback.', '');
  await ctx.db.patch(triggerHistoryId as Id<'guanzhao_trigger_history'>, { feedback });

  // Auto-downgrade frequency if user complains about frequency
  if (feedback === 'too_frequent') {
    const budget = await ctx.db
      .query('guanzhao_budget_tracking')
      .withIndex('by_user_id', (q) => q.eq('user_id', userId))
      .first();

    if (budget?.frequency_level) {
      const downgraded = getDowngradedFrequency(budget.frequency_level as string);
      if (downgraded) {
        await ctx.db.patch(budget._id, { frequency_level: downgraded });
      }
    }
  }

  return { success: true, message: 'Thanks for your feedback' };
}

// ============================================================================
// Safety Action Lookup Table
// ============================================================================

type SafetyHandler = () => ActionResponse;

/**
 * 安全操作处理映射表
 * 消除 if-else 链
 */
const SAFETY_HANDLERS: Record<string, SafetyHandler> = {
  'safety.open_resources': () => ({ redirectUrl: '/resources/crisis' }),
  'safety.confirm_safe': () => ({ success: true, message: 'Recorded' }),
};

export function handleSafetyAction(action: string): ActionResponse {
  const handler = SAFETY_HANDLERS[action];
  return handler ? handler() : { error: 'Unknown safety action' };
}
