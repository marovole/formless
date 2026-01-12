import { query, mutation, action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";

// 获取操作历史
export const getActionHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const limit = args.limit ?? 50;

    return await ctx.db
      .query("guanzhaoActionHistory")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(limit);
  },
});

// 记录用户操作
export const recordAction = mutation({
  args: { actionType: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    return await ctx.db.insert("guanzhaoActionHistory", {
      userId: identity.subject,
      actionType: args.actionType,
      createdAt: Date.now(),
    });
  },
});

// 获取推送令牌
export const getPushTokens = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    return await ctx.db
      .query("guanzhaoPushTokens")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
  },
});

// 添加推送令牌
export const addPushToken = mutation({
  args: {
    token: v.string(),
    deviceType: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // 检查是否已存在
    const existing = await ctx.db
      .query("guanzhaoPushTokens")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), identity.subject),
          q.eq(q.field("token"), args.token)
        )
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("guanzhaoPushTokens", {
      userId: identity.subject,
      token: args.token,
      deviceType: args.deviceType,
    });
  },
});

// 移除推送令牌
export const removePushToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("guanzhaoPushTokens")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), identity.subject),
          q.eq(q.field("token"), args.token)
        )
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

// 发送观照通知（Action）
export const sendNotification = action({
  args: {
    userId: v.string(),
    title: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    // 获取用户的推送令牌 - 直接查询，因为actions中不能直接调用同文件query
    const pushTokens = await ctx.runQuery(api.guanzhao.actions.getPushTokens);

    // 模拟发送通知（实际项目中需要接入推送服务）
    console.log(`Sending notification to user ${args.userId}:`, {
      title: args.title,
      body: args.body,
      tokens: pushTokens.length,
    });

    return {
      success: true,
      sentTo: pushTokens.length,
    };
  },
});
