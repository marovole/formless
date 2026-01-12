import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

export const handleSessionEvent = mutation({
  args: {
    eventType: v.string(), // session_start, session_end, in_session
    clerkId: v.string(),
    sessionId: v.optional(v.id("user_sessions")),
    timezone: v.optional(v.string()),
    messagesCount: v.optional(v.number())
  },
  handler: async (ctx: MutationCtx, args) => {
    const user = await ctx.db.query("users").withIndex("by_clerk_id", q => q.eq("clerkId", args.clerkId)).first();
    if (!user) throw new Error("User not found");
    const userId = user._id;

    if (args.eventType === 'session_start') {
        const sessionId = await ctx.db.insert("user_sessions", {
            user_id: userId,
            timezone: args.timezone || 'UTC',
            last_activity_at: Date.now()
        });

        const shouldTrigger = await shouldTriggerDailyCheckinNow(ctx, userId);

        return {
            success: true,
            sessionId,
            shouldTrigger: shouldTrigger ? {
                triggerId: 'daily_checkin',
                reason: 'First session of the day'
            } : undefined
        };
    }

    if (args.eventType === 'session_end') {
        if (!args.sessionId) throw new Error("Missing sessionId");
        await ctx.db.patch(args.sessionId, { ended_at: Date.now() });

        const shouldTrigger = await shouldTriggerNightlyWrapupNow(ctx, userId);
        return {
            success: true,
            shouldTrigger: shouldTrigger ? {
                triggerId: 'nightly_wrapup',
                reason: 'Session ended in evening hours'
            } : undefined
        };
    }

    if (args.eventType === 'in_session') {
        if (!args.sessionId) throw new Error("Missing sessionId");
        const updates: any = { last_activity_at: Date.now() };
        if (args.messagesCount !== undefined) updates.messages_count = args.messagesCount;

        await ctx.db.patch(args.sessionId, updates);

        const session = await ctx.db.get(args.sessionId);
        if (!session) throw new Error("Session not found");

        const shouldTrigger = await shouldTriggerOverloadProtectionNow(ctx, userId, session);
         return {
            success: true,
            shouldTrigger: shouldTrigger ? {
                triggerId: 'overload_protection',
                reason: 'Long session detected or late hour'
            } : undefined
        };
    }

    return { error: "Invalid eventType" };
  }
});

export const processAction = mutation({
  args: {
    clerkId: v.string(),
    action: v.string(),
    triggerId: v.optional(v.string()),
    triggerHistoryId: v.optional(v.string())
  },
  handler: async (ctx: MutationCtx, args) => {
    const user = await ctx.db.query("users").withIndex("by_clerk_id", q => q.eq("clerkId", args.clerkId)).first();
    if (!user) throw new Error("User not found");
    const userId = user._id;

    const { action } = args;

    if (action.startsWith('snooze')) {
        let snoozedUntil: Date;
        if (action === 'snooze.24h') {
            snoozedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
        } else if (action === 'snooze.7d') {
            snoozedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        } else if (action === 'snooze.today') {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            snoozedUntil = tomorrow;
        } else {
            return { error: 'Unknown snooze action' };
        }

        const budget = await ctx.db.query("guanzhao_budget_tracking").withIndex("by_user_id", q => q.eq("user_id", userId)).first();
        if (budget) {
            await ctx.db.patch(budget._id, { snoozed_until: snoozedUntil.toISOString() });
        } else {
            await ctx.db.insert("guanzhao_budget_tracking", {
                user_id: userId,
                snoozed_until: snoozedUntil.toISOString()
            });
        }

        return { success: true, message: `已静默至 ${snoozedUntil.toLocaleString()}` };
    }

    if (action === 'disable_guanzhao') {
        const budget = await ctx.db.query("guanzhao_budget_tracking").withIndex("by_user_id", q => q.eq("user_id", userId)).first();
        if (budget) {
            await ctx.db.patch(budget._id, { enabled: false });
        } else {
            await ctx.db.insert("guanzhao_budget_tracking", { user_id: userId, enabled: false });
        }
        return { success: true, message: '观照已关闭' };
    }

    if (action === 'keep_weekly_only') {
        const budget = await ctx.db.query("guanzhao_budget_tracking").withIndex("by_user_id", q => q.eq("user_id", userId)).first();
        if (budget) {
            await ctx.db.patch(budget._id, { frequency_level: 'silent', push_enabled: false });
        } else {
            await ctx.db.insert("guanzhao_budget_tracking", { user_id: userId, frequency_level: 'silent', push_enabled: false });
        }
        return { success: true, message: '已切换至仅保留周回顾模式' };
    }

    if (action === 'open_settings_guanzhao') {
        return { redirectUrl: '/settings/guanzhao' };
    }

    if (action.startsWith('feedback.')) {
        if (!args.triggerHistoryId) return { error: 'Missing triggerHistoryId' };
        const feedback = action.replace('feedback.', '');
        await ctx.db.patch(args.triggerHistoryId as Id<"guanzhao_trigger_history">, { feedback });

        if (feedback === 'too_frequent') {
             const budget = await ctx.db.query("guanzhao_budget_tracking").withIndex("by_user_id", q => q.eq("user_id", userId)).first();
             if (budget && budget.frequency_level) {
                 const levels = ['jingjin', 'zhongdao', 'qingjian', 'silent'];
                 const idx = levels.indexOf(budget.frequency_level);
                 if (idx >= 0 && idx < levels.length - 1) {
                     await ctx.db.patch(budget._id, { frequency_level: levels[idx + 1] });
                 }
             }
        }
        return { success: true, message: '感谢你的反馈' };
    }

    if (action.startsWith('open_flow.')) {
        const flowId = action.replace('open_flow.', '');
        return { redirectUrl: `/flow/${flowId}` };
    }

    if (action.startsWith('safety.')) {
        if (action === 'safety.open_resources') return { redirectUrl: '/resources/crisis' };
        if (action === 'safety.confirm_safe') return { success: true, message: '已记录' };
    }

    return { error: 'Unknown action' };
  }
});

export const evaluateTrigger = mutation({
  args: {
    triggerId: v.string(),
    channel: v.string(), // 'in_app' | 'push'
    clerkId: v.string(),
  },
  handler: async (ctx: MutationCtx, args) => {
    const user = await ctx.db.query("users").withIndex("by_clerk_id", q => q.eq("clerkId", args.clerkId)).first();
    if (!user) return { allowed: false, reason: 'Unauthorized' };
    const userId = user._id;

    // 1. 检查用户设置
    const userSettings = await ctx.db.query("guanzhao_budget_tracking")
      .withIndex("by_user_id", q => q.eq("user_id", userId))
      .first();

    if (!userSettings) return { allowed: false, reason: 'User settings not found' };

    // 2. 检查是否启用
    if (!userSettings.enabled) return { allowed: false, reason: 'Guanzhao is disabled' };

    // 3. 检查静默状态
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

    // 4. 检查 DND (仅 push)
    if (args.channel === 'push') {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

      const dndStart = userSettings.dnd_start || '23:30';
      const dndEnd = userSettings.dnd_end || '08:00';

      if (isTimeInRange(currentTime, dndStart, dndEnd)) {
        return { allowed: false, reason: 'User is in DND period' };
      }
    }

    // 5. 检查冷却时间
    const cooldown = await ctx.db.query("guanzhao_cooldowns")
      .withIndex("by_user_trigger_channel", q => q.eq("user_id", userId).eq("trigger_id", args.triggerId).eq("channel", args.channel))
      .filter(q => q.gt(q.field("cooldown_until"), new Date().toISOString()))
      .first();

    if (cooldown) {
      return {
        allowed: false,
        reason: 'Trigger is in cooldown',
        cooldownUntil: cooldown.cooldown_until,
      };
    }

    // 6. 逻辑返回：目前还缺预算检查和模板选择，但这部分通常在 API 层通过 Config 加载。
    // 为了保持一致，我们将预算和历史记录也移入 Convex。
    return {
      allowed: true,
      userId,
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
    // 1. 消耗预算
    const settings = await ctx.db.query("guanzhao_budget_tracking")
      .withIndex("by_user_id", q => q.eq("user_id", args.userId))
      .first();

    if (settings && args.budgetCost > 0) {
      const updates: any = { updated_at: Date.now() };
      if (args.channel === 'in_app') {
        updates.used_in_app_day = (settings.used_in_app_day || 0) + args.budgetCost;
        updates.used_in_app_week = (settings.used_in_app_week || 0) + args.budgetCost;
      } else {
        updates.used_push_day = (settings.used_push_day || 0) + args.budgetCost;
        updates.used_push_week = (settings.used_push_week || 0) + args.budgetCost;
      }
      await ctx.db.patch(settings._id, updates);
    }

    // 2. 记录历史
    const historyId = await ctx.db.insert("guanzhao_trigger_history", {
      user_id: args.userId,
      trigger_id: args.triggerId,
      template_id: args.templateId,
      channel: args.channel,
      status: 'shown',
    });

    // 3. 设置冷却时间
    if (args.cooldownDays) {
      const until = new Date(Date.now() + args.cooldownDays * 24 * 60 * 60 * 1000).toISOString();
      const existing = await ctx.db.query("guanzhao_cooldowns")
        .withIndex("by_user_trigger_channel", q => q.eq("user_id", args.userId).eq("trigger_id", args.triggerId).eq("channel", args.channel))
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
    const user = await ctx.db.query("users").withIndex("by_clerk_id", q => q.eq("clerkId", args.clerkId)).first();
    if (!user) return null;

    return await ctx.db.query("guanzhao_budget_tracking")
      .withIndex("by_user_id", q => q.eq("user_id", user._id))
      .first();
  }
});

export const updateGuanzhaoSettings = mutation({
  args: {
    clerkId: v.string(),
    updates: v.any(), // Partial<GuanzhaoSettings> + budget fields
  },
  handler: async (ctx: MutationCtx, args) => {
    const user = await ctx.db.query("users").withIndex("by_clerk_id", q => q.eq("clerkId", args.clerkId)).first();
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
    const user = await ctx.db.query("users").withIndex("by_clerk_id", q => q.eq("clerkId", args.clerkId)).first();
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

    // 同时启用推送通知设置
    const budget = await ctx.db.query("guanzhao_budget_tracking").withIndex("by_user_id", q => q.eq("user_id", user._id)).first();
    if (budget) {
      await ctx.db.patch(budget._id, { push_enabled: true });
    } else {
      await ctx.db.insert("guanzhao_budget_tracking", { user_id: user._id, push_enabled: true, enabled: true });
    }

    return { success: true };
  }
});

export const deactivatePushToken = mutation({
  args: {
    clerkId: v.string(),
    token: v.string(),
  },
  handler: async (ctx: MutationCtx, args) => {
    const user = await ctx.db.query("users").withIndex("by_clerk_id", q => q.eq("clerkId", args.clerkId)).first();
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
    const user = await ctx.db.query("users").withIndex("by_clerk_id", q => q.eq("clerkId", args.clerkId)).first();
    if (!user) return [];

    return await ctx.db.query("push_tokens")
      .withIndex("by_user_id", q => q.eq("user_id", user._id))
      .filter(q => q.eq(q.field("is_active"), true))
      .order("desc")
      .collect();
  }
});

// Helper Functions
function isTimeInRange(currentTime: string, startTime: string, endTime: string): boolean {
  const current = parseTime(currentTime);
  const start = parseTime(startTime);
  const end = parseTime(endTime);

  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

async function shouldTriggerDailyCheckinNow(ctx: MutationCtx, userId: Id<"users">) {
    const now = Date.now();
    const dayStart = new Date(now).setHours(0,0,0,0);

    const existing = await ctx.db.query("guanzhao_trigger_history")
        .withIndex("by_user_trigger", q => q.eq("user_id", userId).eq("trigger_id", "daily_checkin"))
        .filter(q => q.eq(q.field("channel"), "in_app"))
        .filter(q => q.gte(q.field("_creationTime"), dayStart))
        .first();

    if (existing) return false;

    const sessionsToday = await ctx.db.query("user_sessions")
        .withIndex("by_user_id", q => q.eq("user_id", userId))
        .filter(q => q.gte(q.field("_creationTime"), dayStart))
        .collect();

    return sessionsToday.length === 1;
}

async function shouldTriggerNightlyWrapupNow(ctx: MutationCtx, userId: Id<"users">) {
    const now = new Date();
    const hour = now.getHours();
    if (hour < 20 || hour >= 23) return false;

    const dayStart = new Date(now).setHours(0,0,0,0);

    const existing = await ctx.db.query("guanzhao_trigger_history")
        .withIndex("by_user_trigger", q => q.eq("user_id", userId).eq("trigger_id", "nightly_wrapup"))
        .filter(q => q.eq(q.field("channel"), "in_app"))
        .filter(q => q.gte(q.field("_creationTime"), dayStart))
        .first();

    if (existing) return false;

    return true;
}

async function shouldTriggerOverloadProtectionNow(ctx: MutationCtx, userId: Id<"users">, session: any) {
    const now = new Date();
    const hour = now.getHours();

    let shouldTrigger = false;
    if (hour >= 0 && hour < 1) shouldTrigger = true;

    if (!shouldTrigger) {
        const durationMinutes = (now.getTime() - session._creationTime) / (1000 * 60);
        if (durationMinutes >= 45) shouldTrigger = true;
    }

    if (!shouldTrigger) return false;

    const recent = await ctx.db.query("guanzhao_trigger_history")
        .withIndex("by_user_trigger", q => q.eq("user_id", userId).eq("trigger_id", "overload_protection"))
        .filter(q => q.eq(q.field("channel"), "in_app"))
        .order("desc")
        .first();

    if (recent) {
        const minutesAgo = (now.getTime() - recent._creationTime) / (1000 * 60);
        if (minutesAgo < 30) return false;
    }

    return true;
}
