import { query, mutation } from "../_generated/server";
import { v } from "convex/values";

// 获取用户预算信息
export const getBudget = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    return await ctx.db
      .query("guanzhaoBudget")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .unique();
  },
});

// 创建或更新预算
export const upsertBudget = mutation({
  args: {
    dailyBudget: v.number(),
    weeklyBudget: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const today = new Date().toISOString().split("T")[0];

    const existing = await ctx.db
      .query("guanzhaoBudget")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        dailyBudget: args.dailyBudget,
        weeklyBudget: args.weeklyBudget,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("guanzhaoBudget", {
        userId: identity.subject,
        dailyBudget: args.dailyBudget,
        dailyUsed: 0,
        weeklyBudget: args.weeklyBudget,
        weeklyUsed: 0,
        lastResetDate: today,
      });
    }
  },
});

// 使用预算
export const useBudget = mutation({
  args: { amount: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const budget = await ctx.db
      .query("guanzhaoBudget")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .unique();

    if (!budget) throw new Error("Budget not found");

    const today = new Date().toISOString().split("T")[0];
    let dailyUsed = budget.dailyUsed;
    let weeklyUsed = budget.weeklyUsed;
    let lastResetDate = budget.lastResetDate;

    // 检查是否需要重置日预算
    if (lastResetDate !== today) {
      // 检查是否需要重置周预算
      const lastReset = new Date(lastResetDate);
      const currentDay = new Date();
      const dayOfWeek = currentDay.getDay();
      const lastDayOfWeek = lastReset.getDay();

      // 如果跨周了，重置周预算
      if (dayOfWeek < lastDayOfWeek || (dayOfWeek === 0 && lastDayOfWeek !== 0)) {
        weeklyUsed = 0;
      }
      dailyUsed = 0;
      lastResetDate = today;
    }

    const newDailyUsed = dailyUsed + args.amount;
    const newWeeklyUsed = weeklyUsed + args.amount;

    // 检查是否超出预算
    if (newDailyUsed > budget.dailyBudget || newWeeklyUsed > budget.weeklyBudget) {
      return { success: false, message: "Budget exceeded" };
    }

    await ctx.db.patch(budget._id, {
      dailyUsed: newDailyUsed,
      weeklyUsed: newWeeklyUsed,
      lastResetDate,
    });

    return { success: true, dailyUsed: newDailyUsed, weeklyUsed: newWeeklyUsed };
  },
});

// 检查预算是否充足
export const checkBudget = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const budget = await ctx.db
      .query("guanzhaoBudget")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .unique();

    if (!budget) {
      return { hasBudget: true, dailyRemaining: 100, weeklyRemaining: 1000 };
    }

    const today = new Date().toISOString().split("T")[0];
    let dailyUsed = budget.dailyUsed;
    let weeklyUsed = budget.weeklyUsed;

    // 检查是否需要重置
    if (budget.lastResetDate !== today) {
      const lastReset = new Date(budget.lastResetDate);
      const currentDay = new Date();
      const dayOfWeek = currentDay.getDay();
      const lastDayOfWeek = lastReset.getDay();

      if (dayOfWeek < lastDayOfWeek || (dayOfWeek === 0 && lastDayOfWeek !== 0)) {
        weeklyUsed = 0;
      }
      dailyUsed = 0;
    }

    const dailyRemaining = Math.max(0, budget.dailyBudget - dailyUsed);
    const weeklyRemaining = Math.max(0, budget.weeklyBudget - weeklyUsed);

    return {
      hasBudget: dailyRemaining > 0 && weeklyRemaining > 0,
      dailyRemaining,
      weeklyRemaining,
      dailyUsed,
      weeklyUsed,
    };
  },
});
