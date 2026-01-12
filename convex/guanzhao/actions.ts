import { query, mutation, action, QueryCtx, MutationCtx } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";

// 获取操作历史
export const getActionHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx: QueryCtx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const limit = args.limit ?? 50;

    return await ctx.db
      .query("guanzhao_trigger_history")
      .withIndex("by_user_id", (q) => q.eq("user_id", identity.subject as any))
      .order("desc")
      .take(limit);
  },
});

// 记录用户操作
export const recordAction = mutation({
  args: { actionType: v.string() },
  handler: async (ctx: MutationCtx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    return await ctx.db.insert("guanzhao_trigger_history", {
      user_id: identity.subject as any,
      trigger_id: args.actionType,
      status: 'action_recorded',
    });
  },
});

// 获取推送令牌
export const getPushTokens = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    return await ctx.db
      .query("push_tokens")
      .withIndex("by_user_id", (q) => q.eq("user_id", identity.subject as any))
      .collect();
  },
});

// 添加推送令牌
export const addPushToken = mutation({
  args: {
    token: v.string(),
    platform: v.string(),
  },
  handler: async (ctx: MutationCtx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // 检查是否已存在
    const existing = await ctx.db
      .query("push_tokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .filter((q) => q.eq(q.field("user_id"), identity.subject as any))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("push_tokens", {
      user_id: identity.subject as any,
      token: args.token,
      platform: args.platform,
    });
  },
});

// 移除推送令牌
export const removePushToken = mutation({
  args: { token: v.string() },
  handler: async (ctx: MutationCtx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("push_tokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .filter((q) => q.eq(q.field("user_id"), identity.subject as any))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
