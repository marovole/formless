import { MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { CHANNELS, GUANZHAO_DND_DEFAULTS } from "./constants";
import { getCurrentTimeInTimezone, isTimeInRange } from "./utils";
import { ensureUserSettings, maybeResetBudgetUsage } from "./budget";

// ============================================================================
// Unified Trigger Validation for Guanzhao (Mindfulness) System
// Eliminates code duplication between evaluateTrigger and fireTrigger
// ============================================================================

export interface TriggerValidationResult {
  allowed: boolean;
  reason?: string;
  snoozedUntil?: string;
  cooldownUntil?: string;
  settings?: Doc<"guanzhao_budget_tracking">;
}

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  dayRemaining: number;
  weekRemaining: number;
}

/**
 * Validates if a trigger can be fired for a user
 * This is the single source of truth for trigger eligibility
 */
export async function validateTriggerEligibility(
  ctx: MutationCtx,
  userId: Id<"users">,
  triggerId: string,
  channel: string
): Promise<TriggerValidationResult> {
  // 1. Load or initialize settings, then apply day/week budget resets
  let settings = await ensureUserSettings(ctx, userId);
  settings = await maybeResetBudgetUsage(ctx, settings);

  // 2. Check if enabled
  if (!settings.enabled) {
    return { allowed: false, reason: "Guanzhao is disabled" };
  }

  // 3. Check snooze status
  if (settings.snoozed_until) {
    const snoozedUntil = new Date(settings.snoozed_until);
    if (snoozedUntil > new Date()) {
      return {
        allowed: false,
        reason: "User is snoozed",
        snoozedUntil: snoozedUntil.toISOString(),
      };
    }
  }

  // 4. Check DND (push only)
  if (channel === CHANNELS.PUSH) {
    const currentTime = getCurrentTimeInTimezone(settings.timezone || "UTC");
    const dndStart = settings.dnd_start || GUANZHAO_DND_DEFAULTS.START;
    const dndEnd = settings.dnd_end || GUANZHAO_DND_DEFAULTS.END;

    if (isTimeInRange(currentTime, dndStart, dndEnd)) {
      return { allowed: false, reason: "User is in DND period" };
    }
  }

  // 5. Check cooldown
  const cooldown = await ctx.db
    .query("guanzhao_cooldowns")
    .withIndex("by_user_trigger_channel", (q) =>
      q
        .eq("user_id", userId)
        .eq("trigger_id", triggerId)
        .eq("channel", channel)
    )
    .filter((q) => q.gt(q.field("cooldown_until"), new Date().toISOString()))
    .first();

  if (cooldown) {
    return {
      allowed: false,
      reason: "Trigger is in cooldown",
      cooldownUntil: cooldown.cooldown_until,
    };
  }

  return {
    allowed: true,
    settings,
  };
}

/**
 * Checks if user has sufficient budget for a trigger
 */
export function checkBudget(
  settings: Doc<"guanzhao_budget_tracking">,
  channel: string,
  budgetCost: number
): BudgetCheckResult {
  if (budgetCost <= 0) {
    return { allowed: true, dayRemaining: Infinity, weekRemaining: Infinity };
  }

  if (channel === CHANNELS.IN_APP) {
    const dayRemaining =
      (settings.budget_in_app_day || 0) - (settings.used_in_app_day || 0);
    const weekRemaining =
      (settings.budget_in_app_week || 0) - (settings.used_in_app_week || 0);

    if (budgetCost > dayRemaining || budgetCost > weekRemaining) {
      return {
        allowed: false,
        reason: "Insufficient budget",
        dayRemaining,
        weekRemaining,
      };
    }

    return { allowed: true, dayRemaining, weekRemaining };
  } else {
    const dayRemaining =
      (settings.budget_push_day || 0) - (settings.used_push_day || 0);
    const weekRemaining =
      (settings.budget_push_week || 0) - (settings.used_push_week || 0);

    if (budgetCost > dayRemaining || budgetCost > weekRemaining) {
      return {
        allowed: false,
        reason: "Insufficient budget",
        dayRemaining,
        weekRemaining,
      };
    }

    return { allowed: true, dayRemaining, weekRemaining };
  }
}

/**
 * Consumes budget after a trigger is fired
 */
export async function consumeBudget(
  ctx: MutationCtx,
  settings: Doc<"guanzhao_budget_tracking">,
  channel: string,
  budgetCost: number
): Promise<Doc<"guanzhao_budget_tracking">> {
  if (budgetCost <= 0) return settings;

  const updates: Record<string, unknown> = { updated_at: Date.now() };

  if (channel === CHANNELS.IN_APP) {
    updates.used_in_app_day = (settings.used_in_app_day || 0) + budgetCost;
    updates.used_in_app_week = (settings.used_in_app_week || 0) + budgetCost;
  } else {
    updates.used_push_day = (settings.used_push_day || 0) + budgetCost;
    updates.used_push_week = (settings.used_push_week || 0) + budgetCost;
  }

  await ctx.db.patch(settings._id, updates);
  return { ...settings, ...updates } as Doc<"guanzhao_budget_tracking">;
}

/**
 * Sets cooldown for a trigger after it's fired
 */
export async function setCooldown(
  ctx: MutationCtx,
  userId: Id<"users">,
  triggerId: string,
  channel: string,
  cooldownDays: number
): Promise<void> {
  const COOLDOWN_DAY_MS = 24 * 60 * 60 * 1000;
  const until = new Date(Date.now() + cooldownDays * COOLDOWN_DAY_MS).toISOString();

  const existing = await ctx.db
    .query("guanzhao_cooldowns")
    .withIndex("by_user_trigger_channel", (q) =>
      q
        .eq("user_id", userId)
        .eq("trigger_id", triggerId)
        .eq("channel", channel)
    )
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, { cooldown_until: until });
  } else {
    await ctx.db.insert("guanzhao_cooldowns", {
      user_id: userId,
      trigger_id: triggerId,
      channel,
      cooldown_until: until,
    });
  }
}
