/**
 * Guanzhao (Mindfulness) Convex Functions
 * Proactive engagement system for user wellbeing
 */

import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

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
  const sessionId = await ctx.db.insert("user_sessions", {
    user_id: userId,
    timezone,
    last_activity_at: Date.now()
  });

  const shouldTrigger = await shouldTriggerDailyCheckinNow(ctx, userId);

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

  const shouldTrigger = await shouldTriggerNightlyWrapupNow(ctx, userId);
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

  const shouldTrigger = await shouldTriggerOverloadProtectionNow(ctx, userId, session);
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
  const budget = await ctx.db.query("guanzhao_budget_tracking")
    .withIndex("by_user_id", q => q.eq("user_id", userId))
    .first();

  if (budget) {
    await ctx.db.patch(budget._id, updates);
  } else {
    await ctx.db.insert("guanzhao_budget_tracking", { user_id: userId, ...updates });
  }
}

// ============================================================================
// Exported Mutations
// ============================================================================

export const handleSessionEvent = mutation({
  args: {
    eventType: v.string(),
    clerkId: v.string(),
    sessionId: v.optional(v.id("user_sessions")),
    timezone: v.optional(v.string()),
    messagesCount: v.optional(v.number())
  },
  handler: async (ctx: MutationCtx, args): Promise<SessionEventResponse> => {
    const user = await ctx.db.query("users")
      .withIndex("by_clerk_id", q => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("User not found");

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
    clerkId: v.string(),
    action: v.string(),
    triggerId: v.optional(v.string()),
    triggerHistoryId: v.optional(v.string())
  },
  handler: async (ctx: MutationCtx, args): Promise<ActionResponse> => {
    const user = await ctx.db.query("users")
      .withIndex("by_clerk_id", q => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("User not found");

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
    clerkId: v.string(),
  },
  handler: async (ctx: MutationCtx, args) => {
    const user = await ctx.db.query("users")
      .withIndex("by_clerk_id", q => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) return { allowed: false, reason: 'Unauthorized' };

    // 1. Check user settings
    const userSettings = await ctx.db.query("guanzhao_budget_tracking")
      .withIndex("by_user_id", q => q.eq("user_id", user._id))
      .first();

    if (!userSettings) return { allowed: false, reason: 'User settings not found' };

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
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

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
      userId: user._id,
      userSettings,
    };
  }
});

export const recordTriggerAndConsumeBudget = mutation({
  args: {
    userId: v.id("users"),
    triggerId: v.string(),
    templateId: v.string(),
    channel: v.string(),
    budgetCost: v.number(),
    cooldownDays: v.optional(v.number()),
  },
  handler: async (ctx: MutationCtx, args) => {
    // 1. Consume budget
    const settings = await ctx.db.query("guanzhao_budget_tracking")
      .withIndex("by_user_id", q => q.eq("user_id", args.userId))
      .first();

    if (settings && args.budgetCost > 0) {
      const updates: BudgetUpdate = { updated_at: Date.now() };
      if (args.channel === CHANNELS.IN_APP) {
        updates.used_in_app_day = (settings.used_in_app_day || 0) + args.budgetCost;
        updates.used_in_app_week = (settings.used_in_app_week || 0) + args.budgetCost;
      } else {
        updates.used_push_day = (settings.used_push_day || 0) + args.budgetCost;
        updates.used_push_week = (settings.used_push_week || 0) + args.budgetCost;
      }
      await ctx.db.patch(settings._id, updates);
    }

    // 2. Record history
    const historyId = await ctx.db.insert("guanzhao_trigger_history", {
      user_id: args.userId,
      trigger_id: args.triggerId,
      template_id: args.templateId,
      channel: args.channel,
      status: 'shown',
    });

    // 3. Set cooldown
    if (args.cooldownDays) {
      const until = new Date(Date.now() + args.cooldownDays * GUANZHAO_DURATIONS.COOLDOWN_DAY_MS).toISOString();
      const existing = await ctx.db.query("guanzhao_cooldowns")
        .withIndex("by_user_trigger_channel", q =>
          q.eq("user_id", args.userId).eq("trigger_id", args.triggerId).eq("channel", args.channel))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, { cooldown_until: until });
      } else {
        await ctx.db.insert("guanzhao_cooldowns", {
          user_id: args.userId,
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
    userId: v.id("users"),
    triggerId: v.string(),
    limit: v.number(),
  },
  handler: async (ctx: QueryCtx, args) => {
    return await ctx.db.query("guanzhao_trigger_history")
      .withIndex("by_user_trigger", q => q.eq("user_id", args.userId).eq("trigger_id", args.triggerId))
      .order("desc")
      .take(args.limit);
  }
});

export const getGuanzhaoSettings = query({
  args: { clerkId: v.string() },
  handler: async (ctx: QueryCtx, args) => {
    const user = await ctx.db.query("users")
      .withIndex("by_clerk_id", q => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) return null;

    return await ctx.db.query("guanzhao_budget_tracking")
      .withIndex("by_user_id", q => q.eq("user_id", user._id))
      .first();
  }
});

export const updateGuanzhaoSettings = mutation({
  args: {
    clerkId: v.string(),
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
    const user = await ctx.db.query("users")
      .withIndex("by_clerk_id", q => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("User not found");

    const existing = await ctx.db.query("guanzhao_budget_tracking")
      .withIndex("by_user_id", q => q.eq("user_id", user._id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args.updates, updated_at: Date.now() });
      return { success: true, settings: { ...existing, ...args.updates } };
    } else {
      const id = await ctx.db.insert("guanzhao_budget_tracking", {
        user_id: user._id,
        ...args.updates,
        updated_at: Date.now(),
      });
      return { success: true, settings: { _id: id, user_id: user._id, ...args.updates } };
    }
  }
});

export const registerPushToken = mutation({
  args: {
    clerkId: v.string(),
    token: v.string(),
    platform: v.string(),
    deviceId: v.optional(v.string()),
  },
  handler: async (ctx: MutationCtx, args) => {
    const user = await ctx.db.query("users")
      .withIndex("by_clerk_id", q => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("User not found");

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
    clerkId: v.string(),
    token: v.string(),
  },
  handler: async (ctx: MutationCtx, args) => {
    const user = await ctx.db.query("users")
      .withIndex("by_clerk_id", q => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("User not found");

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
  args: { clerkId: v.string() },
  handler: async (ctx: QueryCtx, args) => {
    const user = await ctx.db.query("users")
      .withIndex("by_clerk_id", q => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) return [];

    return await ctx.db.query("push_tokens")
      .withIndex("by_user_id", q => q.eq("user_id", user._id))
      .filter(q => q.eq(q.field("is_active"), true))
      .order("desc")
      .collect();
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

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
  userId: Id<"users">
): Promise<boolean> {
  const now = Date.now();
  const dayStart = new Date(now).setHours(0, 0, 0, 0);

  const existing = await ctx.db.query("guanzhao_trigger_history")
    .withIndex("by_user_trigger", q =>
      q.eq("user_id", userId).eq("trigger_id", TRIGGER_IDS.DAILY_CHECKIN))
    .filter(q => q.eq(q.field("channel"), CHANNELS.IN_APP))
    .filter(q => q.gte(q.field("_creationTime"), dayStart))
    .first();

  if (existing) return false;

  const sessionsToday = await ctx.db.query("user_sessions")
    .withIndex("by_user_id", q => q.eq("user_id", userId))
    .filter(q => q.gte(q.field("_creationTime"), dayStart))
    .collect();

  return sessionsToday.length === 1;
}

async function shouldTriggerNightlyWrapupNow(
  ctx: MutationCtx,
  userId: Id<"users">
): Promise<boolean> {
  const now = new Date();
  const hour = now.getHours();

  if (hour < GUANZHAO_HOUR_RANGES.NIGHTLY_WRAPUP_START ||
      hour >= GUANZHAO_HOUR_RANGES.NIGHTLY_WRAPUP_END) {
    return false;
  }

  const dayStart = new Date(now).setHours(0, 0, 0, 0);

  const existing = await ctx.db.query("guanzhao_trigger_history")
    .withIndex("by_user_trigger", q =>
      q.eq("user_id", userId).eq("trigger_id", TRIGGER_IDS.NIGHTLY_WRAPUP))
    .filter(q => q.eq(q.field("channel"), CHANNELS.IN_APP))
    .filter(q => q.gte(q.field("_creationTime"), dayStart))
    .first();

  return !existing;
}

async function shouldTriggerOverloadProtectionNow(
  ctx: MutationCtx,
  userId: Id<"users">,
  session: Doc<'user_sessions'>
): Promise<boolean> {
  const now = new Date();
  const hour = now.getHours();

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
