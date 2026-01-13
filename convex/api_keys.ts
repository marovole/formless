import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * API key defaults
 * Note: Duplicated from lib/constants since Convex runs in separate environment
 */
const API_KEY_DEFAULTS = {
  DAILY_LIMIT: 1000,
  RESET_INTERVAL_MS: 24 * 60 * 60 * 1000, // 24 hours
} as const;

// ============ Admin Queries ============

export const list = query({
  args: {},
  handler: async (ctx) => {
    const keys = await ctx.db.query("api_keys").collect();
    return keys.sort((a, b) => (a.priority || 0) - (b.priority || 0));
  },
});

export const getById = query({
  args: { id: v.id("api_keys") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getAvailable = mutation({
  args: { provider: v.string() },
  handler: async (ctx, args) => {
    const keys = await ctx.db
      .query("api_keys")
      .withIndex("by_provider_priority", (q) => q.eq("provider", args.provider))
      .filter((q) => q.eq(q.field("is_active"), true))
      .collect();

    if (!keys.length) return null;

    for (const key of keys) {
      const resetAt = key.reset_at || 0;

      // Reset daily usage if the reset time has passed
      if (resetAt < Date.now()) {
        await ctx.db.patch(key._id, {
          daily_used: 0,
          reset_at: Date.now() + API_KEY_DEFAULTS.RESET_INTERVAL_MS,
        });
        key.daily_used = 0;
      }

      if ((key.daily_used || 0) < (key.daily_limit || API_KEY_DEFAULTS.DAILY_LIMIT)) {
        return key;
      }
    }

    return keys[0];
  },
});

// ============ Admin Mutations ============

export const create = mutation({
  args: {
    provider: v.string(),
    api_key: v.string(),
    model_name: v.optional(v.string()),
    daily_limit: v.optional(v.number()),
    priority: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("api_keys", {
      provider: args.provider,
      api_key: args.api_key,
      model_name: args.model_name || undefined,
      daily_limit: args.daily_limit || API_KEY_DEFAULTS.DAILY_LIMIT,
      daily_used: 0,
      priority: args.priority || 1,
      is_active: true,
      reset_at: Date.now() + API_KEY_DEFAULTS.RESET_INTERVAL_MS,
      updated_at: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("api_keys"),
    api_key: v.optional(v.string()),
    model_name: v.optional(v.string()),
    daily_limit: v.optional(v.number()),
    priority: v.optional(v.number()),
    is_active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const updateData: Record<string, unknown> = { ...updates, updated_at: Date.now() };
    if (updates.api_key === undefined) delete updateData.api_key;
    await ctx.db.patch(id, updateData);
  },
});

export const toggleActive = mutation({
  args: { id: v.id("api_keys") },
  handler: async (ctx, args) => {
    const key = await ctx.db.get(args.id);
    if (key) {
      await ctx.db.patch(args.id, {
        is_active: !key.is_active,
        updated_at: Date.now(),
      });
    }
  },
});

export const deleteKey = mutation({
  args: { id: v.id("api_keys") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const incrementUsage = mutation({
  args: {
    keyId: v.id("api_keys"),
    tokenCount: v.number(),
  },
  handler: async (ctx, args) => {
    const key = await ctx.db.get(args.keyId);
    if (key) {
      await ctx.db.patch(args.keyId, {
        daily_used: (key.daily_used || 0) + args.tokenCount,
        last_used_at: Date.now(),
      });
    }
  },
});

// ============ Usage Stats ============

export const getUsageStats = query({
  args: {},
  handler: async (ctx) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    // Use index for efficient time-range query
    const todayUsage = await ctx.db
      .query("api_usage")
      .withIndex("by_created_at", (q) => q.gt("created_at", todayTimestamp))
      .collect();

    const keys = await ctx.db.query("api_keys").collect();

    return {
      total_calls_today: todayUsage.length,
      successful_calls_today: todayUsage.filter((u) => u.success).length,
      total_tokens_today: todayUsage.reduce((sum, u) => sum + (u.tokens_used || 0), 0),
      keys_status: keys.map((k) => ({
        id: k._id,
        provider: k.provider,
        model_name: k.model_name,
        daily_limit: k.daily_limit ?? API_KEY_DEFAULTS.DAILY_LIMIT,
        daily_used: k.daily_used ?? 0,
      })),
      recent_usage: todayUsage.slice(-50).reverse().map((u) => ({
        id: u._id,
        provider: u.provider,
        model_name: u.model_name,
        tokens_used: u.tokens_used || 0,
        success: u.success || false,
        created_at: new Date(u.created_at || u._creationTime).toISOString(),
      })),
    };
  },
});
