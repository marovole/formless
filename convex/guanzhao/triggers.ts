import { query, mutation, action } from "../_generated/server";
import { v } from "convex/values";

// 获取触发历史
export const getTriggerHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const limit = args.limit ?? 50;

    return await ctx.db
      .query("guanzhaoTriggerHistory")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(limit);
  },
});

// 记录触发事件
export const recordTrigger = mutation({
  args: {
    triggerType: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    return await ctx.db.insert("guanzhaoTriggerHistory", {
      userId: identity.subject,
      triggerType: args.triggerType,
      status: args.status,
      createdAt: Date.now(),
    });
  },
});

// 获取会话事件
export const getSessionEvents = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    return await ctx.db
      .query("guanzhaoSessionEvents")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(100);
  },
});

// 记录会话事件
export const recordSessionEvent = mutation({
  args: {
    eventType: v.string(),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    return await ctx.db.insert("guanzhaoSessionEvents", {
      userId: identity.subject,
      eventType: args.eventType,
      duration: args.duration,
      createdAt: Date.now(),
    });
  },
});

// 评估触发条件（Action - 可以调用外部 API）
export const evaluateTrigger = action({
  args: {
    triggerType: v.string(),
    sessionData: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // 这里可以调用外部 LLM API 来评估是否需要触发观照
    // 目前返回模拟结果，实际项目中需要接入 LLM 服务

    const shouldTrigger = Math.random() > 0.7; // 模拟：30% 概率触发

    return {
      shouldTrigger,
      confidence: shouldTrigger ? 0.85 : 0.15,
      reason: shouldTrigger ? "Based on session patterns" : "No significant patterns detected",
    };
  },
});
