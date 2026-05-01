import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireIdentity } from "./_lib/auth";
import { ensureCurrentUserFromIdentity } from "./_lib/ensure_user";

export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
  },
});

export const ensureCurrent = mutation({
  args: {
    preferredLanguage: v.optional(v.string()),
    fullName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    return await ensureCurrentUserFromIdentity(ctx, identity, args);
  },
});

export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return null;
    return user.profile || {};
  },
});

export const updateProfile = mutation({
  args: {
    updates: v.any(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    const current = user.profile || {};
    const updates = args.updates || {};
    const next = {
      ...current,
      ...updates,
      last_memory_update: new Date().toISOString(),
    };

    await ctx.db.patch(user._id, { profile: next, updated_at: Date.now() });
    return next;
  },
});

