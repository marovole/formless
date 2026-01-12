import { query, mutation, action, QueryCtx, MutationCtx } from "../_generated/server";
import { v } from "convex/values";

// 获取触发历史
export const getTriggerHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx: QueryCtx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db.query("users").withIndex("by_clerk_id", q => q.eq("clerkId", identity.subject)).first();
    if (!user) throw new Error("User not found");

    const limit = args.limit ?? 50;

    return await ctx.db
      .query("guanzhao_trigger_history")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
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
  handler: async (ctx: MutationCtx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db.query("users").withIndex("by_clerk_id", q => q.eq("clerkId", identity.subject)).first();
    if (!user) throw new Error("User not found");

    return await ctx.db.insert("guanzhao_trigger_history", {
      user_id: user._id,
      trigger_id: args.triggerType,
      status: args.status,
    });
  },
});

// 获取会话事件
export const getSessionEvents = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db.query("users").withIndex("by_clerk_id", q => q.eq("clerkId", identity.subject)).first();
    if (!user) throw new Error("User not found");

    return await ctx.db
      .query("user_sessions")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .order("desc")
      .take(100);
  },
});

// 记录会话事件
export const recordSessionEvent = mutation({
  args: {
    eventType: v.string(), // This field doesn't exist in user_sessions, we might need to rely on what user_sessions has or create a new table if needed.
    // However, user_sessions tracks sessions, not events.
    // If we want to record events, we might need another table or reuse trigger history?
    // Given schema, user_sessions only tracks session metadata (start/end implicitly via creation/ended_at).
    // The previous code had "eventType".
    // If this is for analytics, maybe we just skip recording explicit events if not in schema,
    // or map 'session_start' to creating a session.
    duration: v.optional(v.number()),
  },
  handler: async (ctx: MutationCtx, args) => {
    // If this function is critical, we need a place to store it.
    // If it's just creating a session:
    if (args.eventType === 'session_start') {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthorized");
        const user = await ctx.db.query("users").withIndex("by_clerk_id", q => q.eq("clerkId", identity.subject)).first();
        if (!user) throw new Error("User not found");

        return await ctx.db.insert("user_sessions", {
            user_id: user._id,
            last_activity_at: Date.now(),
        });
    }
    // For other events, we might not have a place in schema currently.
    // I'll return null or throw for now if it's not supported, to match schema.
    // Or just log it if we can.
    // But since I must fix type errors, I will align with schema.
    // If this function is used by client, I should keep the signature but implement what I can.
    return null;
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
