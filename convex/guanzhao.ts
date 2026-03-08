/**
 * Guanzhao (Mindfulness) Convex Functions
 * Proactive engagement system for user wellbeing
 * 
 * This file exports all public mutations and queries.
 * Implementation details are in the ./guanzhao/ subdirectory.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import guanzhaoBundle from "../docs/guanzhao/guanzhao-bundle.json";
import { requireCurrentUser } from "./_lib/auth";

import { CHANNELS } from "./guanzhao/constants";
import type { SessionEventResponse, ActionResponse, GuanzhaoConfig } from "./guanzhao/types";
import { handleSessionStart, handleSessionEnd, handleInSession } from "./guanzhao/session_events";
import {
  handleSnoozeAction,
  handleDisableAction,
  handleKeepWeeklyOnlyAction,
  handleFeedbackAction,
  handleSafetyAction
} from "./guanzhao/actions";
import { ensureUserSettings, normalizeSettingsUpdate } from "./guanzhao/budget";
import {
  registerPushToken as registerPushTokenImpl,
  deactivatePushToken as deactivatePushTokenImpl,
  getPushTokens as getPushTokensImpl
} from "./guanzhao/push";
import {
  getTriggerConfig,
  getTemplateConfig,
  getCurrentLocalKeys
} from "./guanzhao/utils";
import {
  validateTriggerEligibility,
  checkBudget,
  consumeBudget,
  setCooldown
} from "./guanzhao/validation";

export const handleSessionEvent = mutation({
  args: {
    eventType: v.string(),
    sessionId: v.optional(v.id("user_sessions")),
    timezone: v.optional(v.string()),
    messagesCount: v.optional(v.number())
  },
  handler: async (ctx, args): Promise<SessionEventResponse> => {
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
  handler: async (ctx, args): Promise<ActionResponse> => {
    const user = await requireCurrentUser(ctx);
    const { action } = args;

    if (action.startsWith('snooze')) {
      return handleSnoozeAction(ctx, user._id, action);
    }
    if (action.startsWith('feedback.')) {
      return handleFeedbackAction(ctx, user._id, action, args.triggerHistoryId);
    }
    if (action.startsWith('open_flow.')) {
      return { redirectUrl: `/flow/${action.replace('open_flow.', '')}` };
    }
    if (action.startsWith('safety.')) {
      return handleSafetyAction(action);
    }
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
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const validation = await validateTriggerEligibility(ctx, user._id, args.triggerId, args.channel);
    
    if (!validation.allowed) {
      return {
        allowed: false,
        reason: validation.reason,
        snoozedUntil: validation.snoozedUntil,
        cooldownUntil: validation.cooldownUntil,
      };
    }

    return { allowed: true, userSettings: validation.settings };
  }
});

export const fireTrigger = mutation({
  args: {
    triggerId: v.string(),
    channel: v.string(),
  },
  handler: async (ctx, args) => {
    const trigger = getTriggerConfig(args.triggerId);
    if (!trigger) {
      return { allowed: false, reason: "Trigger not found" };
    }

    if (args.channel !== CHANNELS.IN_APP && args.channel !== CHANNELS.PUSH) {
      return { allowed: false, reason: "Invalid channel" };
    }

    const user = await requireCurrentUser(ctx);
    const validation = await validateTriggerEligibility(ctx, user._id, args.triggerId, args.channel);
    
    if (!validation.allowed) {
      return {
        allowed: false,
        reason: validation.reason,
        snoozedUntil: validation.snoozedUntil,
        cooldownUntil: validation.cooldownUntil,
      };
    }

    let settings = validation.settings!;
    const budgetCost = (trigger.budget_cost as Record<string, number> | undefined)?.[args.channel] ?? 0;

    const budgetCheck = checkBudget(settings, args.channel, budgetCost);
    if (!budgetCheck.allowed) {
      return { allowed: false, reason: budgetCheck.reason };
    }

    const userStyle = settings.style || (guanzhaoBundle as GuanzhaoConfig).defaults.style;
    const byStyle = trigger.template_sets?.by_style as unknown as Record<string, string[]> | undefined;
    const fallbackStyle = trigger.template_sets?.fallback_style || "qingming";
    const templateIds = byStyle?.[userStyle] || byStyle?.[fallbackStyle] || [];

    if (templateIds.length === 0) {
      return { allowed: false, reason: "No templates available" };
    }

    const recentHistory = await ctx.db
      .query("guanzhao_trigger_history")
      .withIndex("by_user_trigger", (q) => q.eq("user_id", user._id).eq("trigger_id", args.triggerId))
      .order("desc")
      .take(templateIds.length);

    const recentlyUsed = new Set(recentHistory.map((h) => h.template_id).filter(Boolean) as string[]);
    const availableTemplateIds = templateIds.filter((id) => !recentlyUsed.has(id));
    const chosenPool = availableTemplateIds.length > 0 ? availableTemplateIds : templateIds;
    const selectedTemplateId = chosenPool[Math.floor(Math.random() * chosenPool.length)];

    const template = getTemplateConfig(selectedTemplateId);
    if (!template) {
      return { allowed: false, reason: "Template not found" };
    }

    if (budgetCost > 0) {
      settings = await consumeBudget(ctx, settings, args.channel, budgetCost);
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

    const channelConfig = (trigger as Record<string, unknown>)?.[args.channel] as Record<string, unknown> | undefined;
    const constraints = channelConfig?.constraints as Record<string, unknown> | undefined;
    const cooldownDays = constraints?.cooldown_days as number | undefined;
    
    if (cooldownDays) {
      await setCooldown(ctx, user._id, args.triggerId, args.channel, cooldownDays);
    }

    return { allowed: true, triggerId: args.triggerId, template, historyId };
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
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const validation = await validateTriggerEligibility(ctx, user._id, args.triggerId, args.channel);
    
    if (!validation.allowed) {
      throw new Error(validation.reason || "Trigger not allowed");
    }

    let settings = validation.settings!;
    
    if (args.budgetCost > 0) {
      const budgetCheck = checkBudget(settings, args.channel, args.budgetCost);
      if (!budgetCheck.allowed) {
        throw new Error(budgetCheck.reason || "Insufficient budget");
      }
      settings = await consumeBudget(ctx, settings, args.channel, args.budgetCost);
    }

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

    if (args.cooldownDays) {
      await setCooldown(ctx, user._id, args.triggerId, args.channel, args.cooldownDays);
    }

    return { success: true, historyId };
  }
});

export const getRecentTriggerHistory = query({
  args: {
    triggerId: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    return ctx.db.query("guanzhao_trigger_history")
      .withIndex("by_user_trigger", q => q.eq("user_id", user._id).eq("trigger_id", args.triggerId))
      .order("desc")
      .take(args.limit);
  }
});

export const getGuanzhaoSettings = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    return ctx.db
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
  handler: async (ctx, args) => {
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
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    return registerPushTokenImpl(ctx, user._id, args.token, args.platform, args.deviceId);
  }
});

export const deactivatePushToken = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    return deactivatePushTokenImpl(ctx, user._id, args.token);
  }
});

export const getPushTokens = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    return getPushTokensImpl(ctx, user._id);
  }
});
