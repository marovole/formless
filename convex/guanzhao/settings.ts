import { query, mutation, QueryCtx, MutationCtx } from "../_generated/server";
import { v } from "convex/values";

// 获取用户观照设置
export const getSettings = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db.query("users").withIndex("by_clerk_id", q => q.eq("clerkId", identity.subject)).first();
    if (!user) throw new Error("User not found");

    const settings = await ctx.db
      .query("guanzhao_budget_tracking")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .unique();

    if (!settings) return null;

    return {
      _id: settings._id,
      userId: identity.subject,
      enabled: settings.enabled,
      frequency: settings.frequency_level,
      style: settings.style,
      quietHoursStart: settings.dnd_start,
      quietHoursEnd: settings.dnd_end,
    };
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
  handler: async (ctx: MutationCtx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db.query("users").withIndex("by_clerk_id", q => q.eq("clerkId", identity.subject)).first();
    if (!user) throw new Error("User not found");

    const existing = await ctx.db
      .query("guanzhao_budget_tracking")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        enabled: args.enabled,
        frequency_level: args.frequency,
        style: args.style,
        dnd_start: args.quietHoursStart,
        dnd_end: args.quietHoursEnd,
        updated_at: Date.now(),
      });
      return existing._id;
    } else {
      return await ctx.db.insert("guanzhao_budget_tracking", {
        user_id: user._id,
        enabled: args.enabled,
        frequency_level: args.frequency,
        style: args.style,
        dnd_start: args.quietHoursStart,
        dnd_end: args.quietHoursEnd,
        updated_at: Date.now(),
        // Initialize budget fields to defaults or 0 if creating new
        budget_in_app_day: 100, // Default
        used_in_app_day: 0,
        budget_in_app_week: 1000, // Default
        used_in_app_week: 0,
        push_enabled: true,
      });
    }
  },
});

// 更新启用状态
export const updateEnabled = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx: MutationCtx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db.query("users").withIndex("by_clerk_id", q => q.eq("clerkId", identity.subject)).first();
    if (!user) throw new Error("User not found");

    const existing = await ctx.db
      .query("guanzhao_budget_tracking")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { enabled: args.enabled });
    }
  },
});

// 删除设置
export const removeSettings = mutation({
  args: {},
  handler: async (ctx: MutationCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db.query("users").withIndex("by_clerk_id", q => q.eq("clerkId", identity.subject)).first();
    if (!user) throw new Error("User not found");

    const existing = await ctx.db
      .query("guanzhao_budget_tracking")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .unique();

    if (existing) {
      // Instead of deleting (which would delete budget too), maybe just disable or reset settings fields?
      // Or if the intent is to remove tracking entirely, delete is fine.
      // But since budget is mixed, deleting might be destructive.
      // Let's assume delete means remove all tracking data.
      await ctx.db.delete(existing._id);
    }
  },
});
