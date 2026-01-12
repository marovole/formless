import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// 获取当前用户信息
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    // 通过 clerkId 索引查找用户
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    return user;
  },
});

// 创建或更新用户（通过 Webhook 或同步函数调用）
export const upsertUser = mutation({
  args: {
    email: v.string(),
    fullName: v.optional(v.string()),
    profile: v.optional(v.string()),
    preferredLanguage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // 通过 clerkId 索引查找现有用户
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        fullName: args.fullName,
        profile: args.profile,
        preferredLanguage: args.preferredLanguage,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("users", {
        clerkId: identity.subject,
        email: args.email,
        fullName: args.fullName,
        profile: args.profile,
        preferredLanguage: args.preferredLanguage,
        createdAt: Date.now(),
      });
    }
  },
});

// 更新用户偏好语言
export const updatePreferredLanguage = mutation({
  args: { preferredLanguage: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    await ctx.db.patch(identity.subject as any, {
      preferredLanguage: args.preferredLanguage,
    });
  },
});

// 更新用户 Profile
export const updateProfile = mutation({
  args: { profile: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    await ctx.db.patch(identity.subject as any, {
      profile: args.profile,
    });
  },
});

// 删除用户
export const deleteUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    await ctx.db.delete(identity.subject as any);
  },
});
