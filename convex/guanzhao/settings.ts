import { query, mutation } from "../_generated/server";
import { v } from "convex/values";

// 获取用户观照设置
export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    return await ctx.db
      .query("guanzhaoSettings")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .unique();
  },
});

// 创建或更新设置
export const upsertSettings = mutation({
  args: {
    enabled: v.boolean(),
    frequency: v.string(),
    style: v.string(),
    quietHoursStart: v.optional(v.string()),
    quietHoursEnd: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("guanzhaoSettings")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        enabled: args.enabled,
        frequency: args.frequency,
        style: args.style,
        quietHoursStart: args.quietHoursStart,
        quietHoursEnd: args.quietHoursEnd,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("guanzhaoSettings", {
        userId: identity.subject,
        enabled: args.enabled,
        frequency: args.frequency,
        style: args.style,
        quietHoursStart: args.quietHoursStart,
        quietHoursEnd: args.quietHoursEnd,
      });
    }
  },
});

// 更新启用状态
export const updateEnabled = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("guanzhaoSettings")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { enabled: args.enabled });
    }
  },
});

// 删除设置
export const removeSettings = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("guanzhaoSettings")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
