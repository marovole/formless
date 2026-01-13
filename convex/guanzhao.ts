/**
 * Guanzhao (Mindfulness) Convex Functions
 * Proactive engagement system for user wellbeing
 */

import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import guanzhaoBundle from "../docs/guanzhao/guanzhao-bundle.json";
import { requireCurrentUser } from "./_lib/auth";

// ============================================================================
// Constants (duplicated from lib/constants/guanzhao.ts for Convex compatibility)
// ============================================================================

const GUANZHAO_DURATIONS = {
  SNOOZE_24H: 24 * 60 * 60 * 1000,
  SNOOZE_7D: 7 * 24 * 60 * 60 * 1000,
  SESSION_OVERLOAD_MINUTES: 45,
  SESSION_COOLDOWN_MINUTES: 30,
  COOLDOWN_DAY_MS: 24 * 60 * 60 * 1000,
} as const;

const GUANZHAO_HOUR_RANGES = {
  NIGHTLY_WRAPUP_START: 20,
  NIGHTLY_WRAPUP_END: 23,
  LATE_NIGHT_START: 0,
  LATE_NIGHT_END: 1,
} as const;

const GUANZHAO_DND_DEFAULTS = {
  START: '23:30',
  END: '08:00',
} as const;

const FREQUENCY_LEVELS = ['jingjin', 'zhongdao', 'qingjian', 'silent'] as const;

const TRIGGER_IDS = {
  DAILY_CHECKIN: 'daily_checkin',
  NIGHTLY_WRAPUP: 'nightly_wrapup',
  OVERLOAD_PROTECTION: 'overload_protection',
} as const;

const CHANNELS = {
  IN_APP: 'in_app',
  PUSH: 'push',
} as const;

type GuanzhaoConfig = typeof guanzhaoBundle;
type GuanzhaoTrigger = GuanzhaoConfig["triggers"][number];
type GuanzhaoTemplate = GuanzhaoConfig["templates"][number];

// ============================================================================
// Types
// ============================================================================

interface SessionEventResponse {
  success?: boolean;
  sessionId?: Id<'user_sessions'>;
  shouldTrigger?: {
    triggerId: string;
    reason: string;
  };
  error?: string;
}

interface ActionResponse {
  success?: boolean;
  message?: string;
  redirectUrl?: string;
  error?: string;
}

type UserSessionUpdate = Partial<Pick<Doc<'user_sessions'>, 'last_activity_at' | 'ended_at' | 'messages_count'>>;

interface BudgetUpdate {
  updated_at?: number;
  used_in_app_day?: number;
  used_in_app_week?: number;
  used_push_day?: number;
  used_push_week?: number;
}

// ============================================================================
// Session Event Handlers (Split from handleSessionEvent)
// ============================================================================

async function handleSessionStart(
  ctx: MutationCtx,
  userId: Id<'users'>,
  timezone: string
): Promise<SessionEventResponse> {
  const zonedNow = getZonedDate(new Date(), timezone);
  const dayKey = getLocalDateKey(zonedNow);
  const weekKey = getLocalWeekKey(zonedNow);

  const sessionId = await ctx.db.insert("user_sessions", {
    user_id: userId,
    timezone,
    day_key: dayKey,
    week_key: weekKey,
    last_activity_at: Date.now()
  });

  const shouldTrigger = await shouldTriggerDailyCheckinNow(ctx, userId, dayKey);

  return {
    success: true,
    sessionId,
    shouldTrigger: shouldTrigger ? {
      triggerId: TRIGGER_IDS.DAILY_CHECKIN,
      reason: 'First session of the day'
    } : undefined
  };
}

async function handleSessionEnd(
  ctx: MutationCtx,
  userId: Id<'users'>,
  sessionId: Id<'user_sessions'>
): Promise<SessionEventResponse> {
  await ctx.db.patch(sessionId, { ended_at: Date.now() });

  const session = await ctx.db.get(sessionId);
  if (!session) throw new Error("Session not found");

  const timezone = session.timezone || "UTC";
  const zonedNow = getZonedDate(new Date(), timezone);
  const dayKey = getLocalDateKey(zonedNow);

  const shouldTrigger = await shouldTriggerNightlyWrapupNow(
    ctx,
    userId,
    timezone,
    dayKey,
  );
  return {
    success: true,
    shouldTrigger: shouldTrigger ? {
      triggerId: TRIGGER_IDS.NIGHTLY_WRAPUP,
      reason: 'Session ended in evening hours'
    } : undefined
  };
}

async function handleInSession(
  ctx: MutationCtx,
  userId: Id<'users'>,
  sessionId: Id<'user_sessions'>,
  messagesCount?: number
): Promise<SessionEventResponse> {
  const updates: UserSessionUpdate = { last_activity_at: Date.now() };
  if (messagesCount !== undefined) updates.messages_count = messagesCount;

  await ctx.db.patch(sessionId, updates);

  const session = await ctx.db.get(sessionId);
  if (!session) throw new Error("Session not found");

  const shouldTrigger = await shouldTriggerOverloadProtectionNow(
    ctx,
    userId,
    session.timezone || "UTC",
    session,
  );
  return {
    success: true,
    shouldTrigger: shouldTrigger ? {
      triggerId: TRIGGER_IDS.OVERLOAD_PROTECTION,
      reason: 'Long session detected or late hour'
    } : undefined
  };
}

// ============================================================================
// Action Handlers (Refactored from processAction)
// ============================================================================

async function handleSnoozeAction(
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

async function handleDisableAction(
  ctx: MutationCtx,
  userId: Id<'users'>
): Promise<ActionResponse> {
  await upsertBudgetTracking(ctx, userId, { enabled: false });
  return { success: true, message: 'Guanzhao disabled' };
}

async function handleKeepWeeklyOnlyAction(
  ctx: MutationCtx,
  userId: Id<'users'>
): Promise<ActionResponse> {
  await upsertBudgetTracking(ctx, userId, { frequency_level: 'silent', push_enabled: false });
  return { success: true, message: 'Switched to weekly review only mode' };
}

async function handleFeedbackAction(
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
      const idx = FREQUENCY_LEVELS.indexOf(budget.frequency_level as typeof FREQUENCY_LEVELS[number]);
      if (idx >= 0 && idx < FREQUENCY_LEVELS.length - 1) {
        await ctx.db.patch(budget._id, { frequency_level: FREQUENCY_LEVELS[idx + 1] });
      }
    }
  }

  return { success: true, message: 'Thanks for your feedback' };
}

async function handleSafetyAction(action: string): Promise<ActionResponse> {
  if (action === 'safety.open_resources') return { redirectUrl: '/resources/crisis' };
  if (action === 'safety.confirm_safe') return { success: true, message: 'Recorded' };
  return { error: 'Unknown safety action' };
}

// ============================================================================
// Helper: Upsert Budget Tracking
// ============================================================================

async function upsertBudgetTracking(
  ctx: MutationCtx,
  userId: Id<'users'>,
  updates: Record<string, unknown>
): Promise<void> {
  const timezoneHint =
    typeof updates.timezone === "string" ? (updates.timezone as string) : undefined;

  const settings = await ensureUserSettings(ctx, userId, timezoneHint);
  await ctx.db.patch(settings._id, { ...updates, updated_at: Date.now() });
}

// ============================================================================
// Exported Mutations
// ============================================================================

export const handleSessionEvent = mutation({
  args: {
    eventType: v.string(),
    sessionId: v.optional(v.id("user_sessions")),
    timezone: v.optional(v.string()),
    messagesCount: v.optional(v.number())
  },
  handler: async (ctx: MutationCtx, args): Promise<SessionEventResponse> => {
    const user = await requireCurrentUser(ctx);

    if (args.timezone) {
      await ensureUserSettings(ctx, user._id, args.timezone);
    }

    switch (args.eventType) {
      case 'session_start':
        return handleSessionStart(ctx, user._id, args.timezone || 'UTC');
      case 'session_end':
        if (!args.sessionId) throw new Error("Missing sessionId");
        return handleSessionEnd(ctx, user._id, args.sessionId);
      case 'in_session':
        if (!args.sessionId) throw new Error("Missing sessionId");
        return handleInSession(ctx, user._id, args.sessionId, args.messagesCount);
      default:
        return { error: "Invalid eventType" };
    }
  }
});

export const processAction = mutation({
  args: {
    action: v.string(),
    triggerId: v.optional(v.string()),
    triggerHistoryId: v.optional(v.string())
  },
  handler: async (ctx: MutationCtx, args): Promise<ActionResponse> => {
    const user = await requireCurrentUser(ctx);

    const { action } = args;

    // Prefix-based handlers
    if (action.startsWith('snooze')) {
      return handleSnoozeAction(ctx, user._id, action);
    }
    if (action.startsWith('feedback.')) {
      return handleFeedbackAction(ctx, user._id, action, args.triggerHistoryId);
    }
    if (action.startsWith('open_flow.')) {
      const flowId = action.replace('open_flow.', '');
      return { redirectUrl: `/flow/${flowId}` };
    }
    if (action.startsWith('safety.')) {
      return handleSafetyAction(action);
    }

    // Exact match handlers
    if (action === 'disable_guanzhao') {
      return handleDisableAction(ctx, user._id);
    }
    if (action === 'keep_weekly_only') {
      return handleKeepWeeklyOnlyAction(ctx, user._id);
    }
    if (action === 'open_settings_guanzhao') {
      return { redirectUrl: '/settings/guanzhao' };
    }

    return { error: 'Unknown action' };
  }
});

export const evaluateTrigger = mutation({
  args: {
    triggerId: v.string(),
    channel: v.string(),
  },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireCurrentUser(ctx);

    // 1. Load or initialize settings, then apply day/week budget resets.
    let userSettings = await ensureUserSettings(ctx, user._id);
    userSettings = await maybeResetBudgetUsage(ctx, userSettings);

    // 2. Check if enabled
    if (!userSettings.enabled) return { allowed: false, reason: 'Guanzhao is disabled' };

    // 3. Check snooze status
    if (userSettings.snoozed_until) {
      const snoozedUntil = new Date(userSettings.snoozed_until);
      if (snoozedUntil > new Date()) {
        return {
          allowed: false,
          reason: 'User is snoozed',
          snoozedUntil: snoozedUntil.toISOString(),
        };
      }
    }

    // 4. Check DND (push only)
    if (args.channel === CHANNELS.PUSH) {
      const currentTime = getCurrentTimeInTimezone(userSettings.timezone || "UTC");
      const dndStart = userSettings.dnd_start || GUANZHAO_DND_DEFAULTS.START;
      const dndEnd = userSettings.dnd_end || GUANZHAO_DND_DEFAULTS.END;

      if (isTimeInRange(currentTime, dndStart, dndEnd)) {
        return { allowed: false, reason: 'User is in DND period' };
      }
    }

    // 5. Check cooldown
    const cooldown = await ctx.db.query("guanzhao_cooldowns")
      .withIndex("by_user_trigger_channel", q =>
        q.eq("user_id", user._id).eq("trigger_id", args.triggerId).eq("channel", args.channel))
      .filter(q => q.gt(q.field("cooldown_until"), new Date().toISOString()))
      .first();

    if (cooldown) {
      return {
        allowed: false,
        reason: 'Trigger is in cooldown',
        cooldownUntil: cooldown.cooldown_until,
      };
    }

    return {
      allowed: true,
      userSettings,
    };
  }
});

export const fireTrigger = mutation({
  args: {
    triggerId: v.string(),
    channel: v.string(),
  },
  handler: async (ctx: MutationCtx, args) => {
    const trigger = getTriggerConfig(args.triggerId);
    if (!trigger) {
      return { allowed: false, reason: "Trigger not found" };
    }

    if (args.channel !== CHANNELS.IN_APP && args.channel !== CHANNELS.PUSH) {
      return { allowed: false, reason: "Invalid channel" };
    }

    const user = await requireCurrentUser(ctx);

    let settings = await ensureUserSettings(ctx, user._id);
    settings = await maybeResetBudgetUsage(ctx, settings);

    if (!settings.enabled) {
      return { allowed: false, reason: "Guanzhao is disabled" };
    }

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

    if (args.channel === CHANNELS.PUSH) {
      const currentTime = getCurrentTimeInTimezone(settings.timezone || "UTC");
      const dndStart = settings.dnd_start || GUANZHAO_DND_DEFAULTS.START;
      const dndEnd = settings.dnd_end || GUANZHAO_DND_DEFAULTS.END;

      if (isTimeInRange(currentTime, dndStart, dndEnd)) {
        return { allowed: false, reason: "User is in DND period" };
      }
    }

    const cooldown = await ctx.db
      .query("guanzhao_cooldowns")
      .withIndex("by_user_trigger_channel", (q) =>
        q
          .eq("user_id", user._id)
          .eq("trigger_id", args.triggerId)
          .eq("channel", args.channel),
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

    const budgetCost = (trigger.budget_cost as Record<string, number> | undefined)?.[
      args.channel
    ] ?? 0;

    if (budgetCost > 0) {
      if (args.channel === CHANNELS.IN_APP) {
        const dayRemaining =
          (settings.budget_in_app_day || 0) - (settings.used_in_app_day || 0);
        const weekRemaining =
          (settings.budget_in_app_week || 0) - (settings.used_in_app_week || 0);
        if (budgetCost > dayRemaining || budgetCost > weekRemaining) {
          return { allowed: false, reason: "Insufficient budget" };
        }
      } else {
        const dayRemaining =
          (settings.budget_push_day || 0) - (settings.used_push_day || 0);
        const weekRemaining =
          (settings.budget_push_week || 0) - (settings.used_push_week || 0);
        if (budgetCost > dayRemaining || budgetCost > weekRemaining) {
          return { allowed: false, reason: "Insufficient budget" };
        }
      }
    }

    const userStyle = settings.style || (guanzhaoBundle as GuanzhaoConfig).defaults.style;
    const byStyle = trigger.template_sets?.by_style as unknown as
      | Record<string, string[]>
      | undefined;
    const fallbackStyle = trigger.template_sets?.fallback_style || "qingming";
    const templateIds = byStyle?.[userStyle] || byStyle?.[fallbackStyle] || [];

    if (templateIds.length === 0) {
      return { allowed: false, reason: "No templates available" };
    }

    const recentHistory = await ctx.db
      .query("guanzhao_trigger_history")
      .withIndex("by_user_trigger", (q) =>
        q.eq("user_id", user._id).eq("trigger_id", args.triggerId),
      )
      .order("desc")
      .take(templateIds.length);

    const recentlyUsed = new Set(
      recentHistory.map((h) => h.template_id).filter(Boolean) as string[],
    );
    const availableTemplateIds = templateIds.filter((id) => !recentlyUsed.has(id));
    const chosenPool = availableTemplateIds.length > 0 ? availableTemplateIds : templateIds;
    const selectedTemplateId = chosenPool[Math.floor(Math.random() * chosenPool.length)];

    const template = getTemplateConfig(selectedTemplateId);
    if (!template) {
      return { allowed: false, reason: "Template not found" };
    }

    if (budgetCost > 0) {
      const updates: BudgetUpdate = { updated_at: Date.now() };
      if (args.channel === CHANNELS.IN_APP) {
        updates.used_in_app_day = (settings.used_in_app_day || 0) + budgetCost;
        updates.used_in_app_week = (settings.used_in_app_week || 0) + budgetCost;
      } else {
        updates.used_push_day = (settings.used_push_day || 0) + budgetCost;
        updates.used_push_week = (settings.used_push_week || 0) + budgetCost;
      }
      await ctx.db.patch(settings._id, updates);
      settings = { ...settings, ...updates } as Doc<"guanzhao_budget_tracking">;
    }

    const keys = getCurrentLocalKeys(settings.timezone || "UTC");
    const historyId = await ctx.db.insert("guanzhao_trigger_history", {
      user_id: user._id,
      trigger_id: args.triggerId,
      template_id: selectedTemplateId,
      channel: args.channel,
      status: "shown",
      day_key: keys.dayKey,
      week_key: keys.weekKey,
    });

    const channelConstraints = (trigger as any)?.[args.channel]?.constraints;
    const cooldownDays = channelConstraints?.cooldown_days as number | undefined;
    if (cooldownDays) {
      const until = new Date(
        Date.now() + cooldownDays * GUANZHAO_DURATIONS.COOLDOWN_DAY_MS,
      ).toISOString();

      const existing = await ctx.db
        .query("guanzhao_cooldowns")
        .withIndex("by_user_trigger_channel", (q) =>
          q
            .eq("user_id", user._id)
            .eq("trigger_id", args.triggerId)
            .eq("channel", args.channel),
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, { cooldown_until: until });
      } else {
        await ctx.db.insert("guanzhao_cooldowns", {
          user_id: user._id,
          trigger_id: args.triggerId,
          channel: args.channel,
          cooldown_until: until,
        });
      }
    }

    return {
      allowed: true,
      triggerId: args.triggerId,
      template,
      historyId,
    };
  },
});

export const recordTriggerAndConsumeBudget = mutation({
  args: {
    triggerId: v.string(),
    templateId: v.string(),
    channel: v.string(),
    budgetCost: v.number(),
    cooldownDays: v.optional(v.number()),
  },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireCurrentUser(ctx);

    let settings = await ensureUserSettings(ctx, user._id);
    settings = await maybeResetBudgetUsage(ctx, settings);

    if (!settings.enabled) {
      throw new Error("Guanzhao is disabled");
    }

    if (settings.snoozed_until) {
      const snoozedUntil = new Date(settings.snoozed_until);
      if (snoozedUntil > new Date()) {
        throw new Error("Guanzhao is snoozed");
      }
    }

    if (args.channel === CHANNELS.PUSH) {
      const currentTime = getCurrentTimeInTimezone(settings.timezone || "UTC");
      const dndStart = settings.dnd_start || GUANZHAO_DND_DEFAULTS.START;
      const dndEnd = settings.dnd_end || GUANZHAO_DND_DEFAULTS.END;
      if (isTimeInRange(currentTime, dndStart, dndEnd)) {
        throw new Error("User is in DND period");
      }
    }

    // 1. Consume budget (after day/week reset).
    if (args.budgetCost > 0) {
      const updates: BudgetUpdate = { updated_at: Date.now() };

      if (args.channel === CHANNELS.IN_APP) {
        const dayRemaining =
          (settings.budget_in_app_day || 0) - (settings.used_in_app_day || 0);
        const weekRemaining =
          (settings.budget_in_app_week || 0) - (settings.used_in_app_week || 0);

        if (args.budgetCost > dayRemaining || args.budgetCost > weekRemaining) {
          throw new Error("Insufficient budget");
        }

        updates.used_in_app_day = (settings.used_in_app_day || 0) + args.budgetCost;
        updates.used_in_app_week = (settings.used_in_app_week || 0) + args.budgetCost;
      } else {
        const dayRemaining =
          (settings.budget_push_day || 0) - (settings.used_push_day || 0);
        const weekRemaining =
          (settings.budget_push_week || 0) - (settings.used_push_week || 0);

        if (args.budgetCost > dayRemaining || args.budgetCost > weekRemaining) {
          throw new Error("Insufficient budget");
        }

        updates.used_push_day = (settings.used_push_day || 0) + args.budgetCost;
        updates.used_push_week = (settings.used_push_week || 0) + args.budgetCost;
      }

      await ctx.db.patch(settings._id, updates);
      settings = { ...settings, ...updates } as Doc<"guanzhao_budget_tracking">;
    }

    // 2. Record history
    const keys = getCurrentLocalKeys(settings.timezone || "UTC");
    const historyId = await ctx.db.insert("guanzhao_trigger_history", {
      user_id: user._id,
      trigger_id: args.triggerId,
      template_id: args.templateId,
      channel: args.channel,
      status: 'shown',
      day_key: keys.dayKey,
      week_key: keys.weekKey,
    });

    // 3. Set cooldown
    if (args.cooldownDays) {
      const until = new Date(Date.now() + args.cooldownDays * GUANZHAO_DURATIONS.COOLDOWN_DAY_MS).toISOString();
      const existing = await ctx.db.query("guanzhao_cooldowns")
        .withIndex("by_user_trigger_channel", q =>
          q.eq("user_id", user._id).eq("trigger_id", args.triggerId).eq("channel", args.channel))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, { cooldown_until: until });
      } else {
        await ctx.db.insert("guanzhao_cooldowns", {
          user_id: user._id,
          trigger_id: args.triggerId,
          channel: args.channel,
          cooldown_until: until,
        });
      }
    }

    return { success: true, historyId };
  }
});

export const getRecentTriggerHistory = query({
  args: {
    triggerId: v.string(),
    limit: v.number(),
  },
  handler: async (ctx: QueryCtx, args) => {
    const user = await requireCurrentUser(ctx);
    return await ctx.db.query("guanzhao_trigger_history")
      .withIndex("by_user_trigger", q => q.eq("user_id", user._id).eq("trigger_id", args.triggerId))
      .order("desc")
      .take(args.limit);
  }
});

export const getGuanzhaoSettings = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const user = await requireCurrentUser(ctx);
    return await ctx.db
      .query("guanzhao_budget_tracking")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .first();
  }
});

export const updateGuanzhaoSettings = mutation({
  args: {
    updates: v.object({
      enabled: v.optional(v.boolean()),
      frequency_level: v.optional(v.string()),
      push_enabled: v.optional(v.boolean()),
      dnd_start: v.optional(v.string()),
      dnd_end: v.optional(v.string()),
      style: v.optional(v.string()),
      snoozed_until: v.optional(v.string()),
    }),
  },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireCurrentUser(ctx);

    const existing = await ensureUserSettings(ctx, user._id);
    const normalized = normalizeSettingsUpdate(existing, args.updates);
    await ctx.db.patch(existing._id, { ...normalized, updated_at: Date.now() });
    return { success: true, settings: { ...existing, ...normalized } };
  }
});

export const registerPushToken = mutation({
  args: {
    token: v.string(),
    platform: v.string(),
    deviceId: v.optional(v.string()),
  },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireCurrentUser(ctx);

    const existing = await ctx.db.query("push_tokens")
      .withIndex("by_token", q => q.eq("token", args.token))
      .filter(q => q.eq(q.field("user_id"), user._id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        last_used_at: Date.now(),
        is_active: true,
        updated_at: Date.now(),
      });
    } else {
      await ctx.db.insert("push_tokens", {
        user_id: user._id,
        token: args.token,
        platform: args.platform,
        device_id: args.deviceId,
        is_active: true,
        last_used_at: Date.now(),
        updated_at: Date.now(),
      });
    }

    // Also enable push notification settings
    await upsertBudgetTracking(ctx, user._id, { push_enabled: true, enabled: true });

    return { success: true };
  }
});

export const deactivatePushToken = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireCurrentUser(ctx);

    const token = await ctx.db.query("push_tokens")
      .withIndex("by_token", q => q.eq("token", args.token))
      .filter(q => q.eq(q.field("user_id"), user._id))
      .first();

    if (token) {
      await ctx.db.patch(token._id, { is_active: false, updated_at: Date.now() });
    }

    return { success: true };
  }
});

export const getPushTokens = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const user = await requireCurrentUser(ctx);

    return await ctx.db
      .query("push_tokens")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .filter(q => q.eq(q.field("is_active"), true))
      .order("desc")
      .collect();
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

function getTriggerConfig(triggerId: string): GuanzhaoTrigger | undefined {
  return (guanzhaoBundle as GuanzhaoConfig).triggers.find((t) => t.id === triggerId);
}

function getTemplateConfig(templateId: string): GuanzhaoTemplate | undefined {
  return (guanzhaoBundle as GuanzhaoConfig).templates.find((t) => t.id === templateId);
}

function getBudgetsForFrequencyLevel(level: string) {
  const config = guanzhaoBundle as GuanzhaoConfig;
  const frequency =
    config.frequency_levels[level as keyof typeof config.frequency_levels];
  if (!frequency) {
    return { in_app_day: 0, in_app_week: 0, push_day: 0, push_week: 0 };
  }

  return {
    in_app_day: frequency.budgets.in_app.per_day,
    in_app_week: frequency.budgets.in_app.per_week,
    push_day: frequency.budgets.push.per_day,
    push_week: frequency.budgets.push.per_week,
  };
}

function getZonedDate(now: Date, timezone: string): Date {
  return new Date(now.toLocaleString("en-US", { timeZone: timezone }));
}

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLocalWeekKey(date: Date): string {
  const dayOfWeek = date.getDay();
  const offset = (dayOfWeek + 6) % 7;
  const start = new Date(date);
  start.setDate(start.getDate() - offset);
  return getLocalDateKey(start);
}

function getCurrentTimeInTimezone(timezone: string): string {
  const zoned = getZonedDate(new Date(), timezone);
  const hours = String(zoned.getHours()).padStart(2, "0");
  const minutes = String(zoned.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

async function initializeUserSettings(
  ctx: MutationCtx,
  userId: Id<"users">,
  timezoneHint?: string,
) {
  const defaults = (guanzhaoBundle as GuanzhaoConfig).defaults;
  const frequencyLevel = defaults.frequency_level;
  const budgets = getBudgetsForFrequencyLevel(frequencyLevel);
  const timezone = timezoneHint || "UTC";
  const zonedNow = getZonedDate(new Date(), timezone);

  const id = await ctx.db.insert("guanzhao_budget_tracking", {
    user_id: userId,
    timezone,
    day_key: getLocalDateKey(zonedNow),
    week_key: getLocalWeekKey(zonedNow),
    enabled: defaults.enabled,
    frequency_level: frequencyLevel,
    push_enabled: defaults.channels.push,
    dnd_start: defaults.dnd_local_time.start,
    dnd_end: defaults.dnd_local_time.end,
    style: defaults.style,
    budget_in_app_day: budgets.in_app_day,
    budget_in_app_week: budgets.in_app_week,
    budget_push_day: budgets.push_day,
    budget_push_week: budgets.push_week,
    used_in_app_day: 0,
    used_in_app_week: 0,
    used_push_day: 0,
    used_push_week: 0,
    updated_at: Date.now(),
  });

  const created = await ctx.db.get(id);
  if (!created) {
    throw new Error("Failed to initialize Guanzhao settings");
  }
  return created;
}

function getCurrentLocalKeys(timezone: string): { dayKey: string; weekKey: string } {
  const zonedNow = getZonedDate(new Date(), timezone);
  return {
    dayKey: getLocalDateKey(zonedNow),
    weekKey: getLocalWeekKey(zonedNow),
  };
}

async function ensureUserSettings(
  ctx: MutationCtx,
  userId: Id<"users">,
  timezoneHint?: string,
): Promise<Doc<"guanzhao_budget_tracking">> {
  let settings = await ctx.db
    .query("guanzhao_budget_tracking")
    .withIndex("by_user_id", (q) => q.eq("user_id", userId))
    .first();

  if (!settings) {
    return await initializeUserSettings(ctx, userId, timezoneHint);
  }

  const config = guanzhaoBundle as GuanzhaoConfig;
  const defaults = config.defaults;

  const nextTimezone = timezoneHint || settings.timezone || "UTC";
  const nextFrequencyLevel = settings.frequency_level || defaults.frequency_level;
  const budgets = getBudgetsForFrequencyLevel(nextFrequencyLevel);
  const keys = getCurrentLocalKeys(nextTimezone);

  const patch: Record<string, unknown> = {};

  if (!settings.timezone) patch.timezone = nextTimezone;
  if (timezoneHint && timezoneHint !== settings.timezone) patch.timezone = timezoneHint;

  if (!settings.day_key) patch.day_key = keys.dayKey;
  if (!settings.week_key) patch.week_key = keys.weekKey;
  if (patch.timezone) {
    patch.day_key = keys.dayKey;
    patch.week_key = keys.weekKey;
  }

  if (settings.enabled === undefined) patch.enabled = defaults.enabled;
  if (!settings.frequency_level) patch.frequency_level = defaults.frequency_level;
  if (settings.push_enabled === undefined) patch.push_enabled = defaults.channels.push;
  if (!settings.dnd_start) patch.dnd_start = defaults.dnd_local_time.start;
  if (!settings.dnd_end) patch.dnd_end = defaults.dnd_local_time.end;
  if (!settings.style) patch.style = defaults.style;

  if (settings.budget_in_app_day === undefined) patch.budget_in_app_day = budgets.in_app_day;
  if (settings.budget_in_app_week === undefined) patch.budget_in_app_week = budgets.in_app_week;
  if (settings.budget_push_day === undefined) patch.budget_push_day = budgets.push_day;
  if (settings.budget_push_week === undefined) patch.budget_push_week = budgets.push_week;

  if (settings.used_in_app_day === undefined) patch.used_in_app_day = 0;
  if (settings.used_in_app_week === undefined) patch.used_in_app_week = 0;
  if (settings.used_push_day === undefined) patch.used_push_day = 0;
  if (settings.used_push_week === undefined) patch.used_push_week = 0;

  if (Object.keys(patch).length > 0) {
    patch.updated_at = Date.now();
    await ctx.db.patch(settings._id, patch);
    settings = { ...settings, ...patch } as Doc<"guanzhao_budget_tracking">;
  }

  return settings;
}

async function maybeResetBudgetUsage(
  ctx: MutationCtx,
  settings: Doc<"guanzhao_budget_tracking">,
): Promise<Doc<"guanzhao_budget_tracking">> {
  const timezone = settings.timezone || "UTC";
  const keys = getCurrentLocalKeys(timezone);

  const patch: Record<string, unknown> = {};

  if (settings.day_key !== keys.dayKey) {
    patch.day_key = keys.dayKey;
    patch.used_in_app_day = 0;
    patch.used_push_day = 0;
  }

  if (settings.week_key !== keys.weekKey) {
    patch.week_key = keys.weekKey;
    patch.used_in_app_week = 0;
    patch.used_push_week = 0;
  }

  if (Object.keys(patch).length > 0) {
    patch.updated_at = Date.now();
    await ctx.db.patch(settings._id, patch);
    return { ...settings, ...patch } as Doc<"guanzhao_budget_tracking">;
  }

  return settings;
}

function normalizeSettingsUpdate(
  existing: Doc<"guanzhao_budget_tracking"> | null,
  updates: {
    enabled?: boolean;
    frequency_level?: string;
    push_enabled?: boolean;
    dnd_start?: string;
    dnd_end?: string;
    style?: string;
    snoozed_until?: string;
  }
) {
  const config = guanzhaoBundle as GuanzhaoConfig;
  const nextFrequency =
    updates.frequency_level ?? existing?.frequency_level ?? config.defaults.frequency_level;
  const budgets = getBudgetsForFrequencyLevel(nextFrequency);

  const normalized: Record<string, unknown> = {
    ...updates,
  };

  if (updates.frequency_level) {
    normalized.budget_in_app_day = budgets.in_app_day;
    normalized.budget_in_app_week = budgets.in_app_week;
    normalized.budget_push_day = budgets.push_day;
    normalized.budget_push_week = budgets.push_week;

    normalized.used_in_app_day = 0;
    normalized.used_in_app_week = 0;
    normalized.used_push_day = 0;
    normalized.used_push_week = 0;

    const timezone = existing?.timezone || "UTC";
    const zonedNow = getZonedDate(new Date(), timezone);
    normalized.day_key = getLocalDateKey(zonedNow);
    normalized.week_key = getLocalWeekKey(zonedNow);
  }

  return normalized;
}

function isTimeInRange(currentTime: string, startTime: string, endTime: string): boolean {
  const current = parseTime(currentTime);
  const start = parseTime(startTime);
  const end = parseTime(endTime);

  // Handle overnight ranges (e.g., 23:30 to 08:00)
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

async function shouldTriggerDailyCheckinNow(
  ctx: MutationCtx,
  userId: Id<"users">,
  dayKey: string,
): Promise<boolean> {
  const existing = await ctx.db.query("guanzhao_trigger_history")
    .withIndex("by_user_trigger_day", (q) =>
      q
        .eq("user_id", userId)
        .eq("trigger_id", TRIGGER_IDS.DAILY_CHECKIN)
        .eq("day_key", dayKey),
    )
    .filter(q => q.eq(q.field("channel"), CHANNELS.IN_APP))
    .first();

  if (existing) return false;

  const sessionsToday = await ctx.db
    .query("user_sessions")
    .withIndex("by_user_day", (q) => q.eq("user_id", userId).eq("day_key", dayKey))
    .take(2);

  return sessionsToday.length === 1;
}

async function shouldTriggerNightlyWrapupNow(
  ctx: MutationCtx,
  userId: Id<"users">,
  timezone: string,
  dayKey: string,
): Promise<boolean> {
  const zonedNow = getZonedDate(new Date(), timezone);
  const hour = zonedNow.getHours();

  if (hour < GUANZHAO_HOUR_RANGES.NIGHTLY_WRAPUP_START ||
      hour >= GUANZHAO_HOUR_RANGES.NIGHTLY_WRAPUP_END) {
    return false;
  }

  const existing = await ctx.db.query("guanzhao_trigger_history")
    .withIndex("by_user_trigger_day", (q) =>
      q
        .eq("user_id", userId)
        .eq("trigger_id", TRIGGER_IDS.NIGHTLY_WRAPUP)
        .eq("day_key", dayKey),
    )
    .filter(q => q.eq(q.field("channel"), CHANNELS.IN_APP))
    .first();

  return !existing;
}

async function shouldTriggerOverloadProtectionNow(
  ctx: MutationCtx,
  userId: Id<"users">,
  timezone: string,
  session: Doc<'user_sessions'>
): Promise<boolean> {
  const now = new Date();
  const zonedNow = getZonedDate(now, timezone);
  const hour = zonedNow.getHours();

  let shouldTrigger = false;

  // Late night check
  if (hour >= GUANZHAO_HOUR_RANGES.LATE_NIGHT_START &&
      hour < GUANZHAO_HOUR_RANGES.LATE_NIGHT_END) {
    shouldTrigger = true;
  }

  // Long session check
  if (!shouldTrigger) {
    const durationMinutes = (now.getTime() - session._creationTime) / (1000 * 60);
    if (durationMinutes >= GUANZHAO_DURATIONS.SESSION_OVERLOAD_MINUTES) {
      shouldTrigger = true;
    }
  }

  if (!shouldTrigger) return false;

  // Check cooldown
  const recent = await ctx.db.query("guanzhao_trigger_history")
    .withIndex("by_user_trigger", q =>
      q.eq("user_id", userId).eq("trigger_id", TRIGGER_IDS.OVERLOAD_PROTECTION))
    .filter(q => q.eq(q.field("channel"), CHANNELS.IN_APP))
    .order("desc")
    .first();

  if (recent) {
    const minutesAgo = (now.getTime() - recent._creationTime) / (1000 * 60);
    if (minutesAgo < GUANZHAO_DURATIONS.SESSION_COOLDOWN_MINUTES) {
      return false;
    }
  }

  return true;
}
