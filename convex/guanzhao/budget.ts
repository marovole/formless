import { query, mutation, QueryCtx, MutationCtx } from "../_generated/server";
import { v } from "convex/values";

// 获取用户预算信息
export const getBudget = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db.query("users").withIndex("by_clerk_id", q => q.eq("clerkId", identity.subject)).first();
    if (!user) throw new Error("User not found");

    return await ctx.db
      .query("guanzhao_budget_tracking")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .unique();
  },
});

// 创建或更新预算
export const upsertBudget = mutation({
  args: {
    dailyBudget: v.number(),
    weeklyBudget: v.number(),
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
        budget_in_app_day: args.dailyBudget,
        budget_in_app_week: args.weeklyBudget,
        updated_at: Date.now(),
      });
      return existing._id;
    } else {
      return await ctx.db.insert("guanzhao_budget_tracking", {
        user_id: user._id,
        budget_in_app_day: args.dailyBudget,
        used_in_app_day: 0,
        budget_in_app_week: args.weeklyBudget,
        used_in_app_week: 0,
        updated_at: Date.now(),
        enabled: true,
      });
    }
  },
});

// 使用预算
export const useBudget = mutation({
  args: { amount: v.number() },
  handler: async (ctx: MutationCtx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db.query("users").withIndex("by_clerk_id", q => q.eq("clerkId", identity.subject)).first();
    if (!user) throw new Error("User not found");

    const budget = await ctx.db
      .query("guanzhao_budget_tracking")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .unique();

    if (!budget) throw new Error("Budget not found");

    const now = Date.now();
    const today = new Date(now).setHours(0,0,0,0);
    const lastUpdate = budget.updated_at || 0;
    const lastUpdateDay = new Date(lastUpdate).setHours(0,0,0,0);

    let dailyUsed = budget.used_in_app_day || 0;
    let weeklyUsed = budget.used_in_app_week || 0;

    // 检查是否需要重置日预算
    if (lastUpdateDay !== today) {
      // 检查是否需要重置周预算
      const lastDate = new Date(lastUpdate);
      const currentDate = new Date(now);
      const dayOfWeek = currentDate.getDay(); // 0 is Sunday
      const lastDayOfWeek = lastDate.getDay();

      if (dayOfWeek < lastDayOfWeek || (now - lastUpdate > 7 * 24 * 60 * 60 * 1000)) {
         weeklyUsed = 0;
      }

      dailyUsed = 0;
    }

    const newDailyUsed = dailyUsed + args.amount;
    const newWeeklyUsed = weeklyUsed + args.amount;

    const dailyBudget = budget.budget_in_app_day || 0;
    const weeklyBudget = budget.budget_in_app_week || 0;

    // 检查是否超出预算
    if (newDailyUsed > dailyBudget || newWeeklyUsed > weeklyBudget) {
      return { success: false, message: "Budget exceeded" };
    }

    await ctx.db.patch(budget._id, {
      used_in_app_day: newDailyUsed,
      used_in_app_week: newWeeklyUsed,
      updated_at: now,
    });

    return { success: true, dailyUsed: newDailyUsed, weeklyUsed: newWeeklyUsed };
  },
});

// 检查预算是否充足
export const checkBudget = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db.query("users").withIndex("by_clerk_id", q => q.eq("clerkId", identity.subject)).first();
    if (!user) {
         return { hasBudget: true, dailyRemaining: 100, weeklyRemaining: 1000 };
    }

    const budget = await ctx.db
      .query("guanzhao_budget_tracking")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .unique();

    if (!budget) {
      return { hasBudget: true, dailyRemaining: 100, weeklyRemaining: 1000 };
    }

    const now = Date.now();
    const today = new Date(now).setHours(0,0,0,0);
    const lastUpdate = budget.updated_at || 0;
    const lastUpdateDay = new Date(lastUpdate).setHours(0,0,0,0);

    let dailyUsed = budget.used_in_app_day || 0;
    let weeklyUsed = budget.used_in_app_week || 0;

    // 检查是否需要重置
    if (lastUpdateDay !== today) {
       const lastDate = new Date(lastUpdate);
       const currentDate = new Date(now);
       const dayOfWeek = currentDate.getDay();
       const lastDayOfWeek = lastDate.getDay();

       if (dayOfWeek < lastDayOfWeek || (now - lastUpdate > 7 * 24 * 60 * 60 * 1000)) {
         weeklyUsed = 0;
       }
       dailyUsed = 0;
    }

    const dailyBudget = budget.budget_in_app_day || 0;
    const weeklyBudget = budget.budget_in_app_week || 0;

    const dailyRemaining = Math.max(0, dailyBudget - dailyUsed);
    const weeklyRemaining = Math.max(0, weeklyBudget - weeklyUsed);

    return {
      hasBudget: dailyRemaining > 0 && weeklyRemaining > 0,
      dailyRemaining,
      weeklyRemaining,
      dailyUsed,
      weeklyUsed,
    };
  },
});
