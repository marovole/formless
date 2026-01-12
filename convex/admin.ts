import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listUsers = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db.query("users")
      .order("desc")
      .take(args.limit || 100);
  }
});

export const getAdminByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.query("admin_users")
      .withIndex("by_email", q => q.eq("email", args.email))
      .first();
  }
});

export const updateAdminLogin = mutation({
  args: { id: v.id("admin_users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      last_login_at: Date.now(),
      updated_at: Date.now(),
    });
  }
});

export const getUsageStats = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const usage = await ctx.db.query("api_usage")
      .order("desc")
      .take(args.limit || 1000);

    const keys = await ctx.db.query("api_keys").collect();

    return { usage, keys };
  }
});
