import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./_lib/auth";

const API_KEY_DEFAULTS = {
  DAILY_LIMIT: 1000,
  RESET_INTERVAL_MS: 24 * 60 * 60 * 1000,
} as const;

function maskKey(value: string): string {
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const keys = await ctx.db.query("api_keys").collect();

    return keys
      .sort((a, b) => (a.priority || 0) - (b.priority || 0))
      .map((k) => ({
        id: k._id,
        provider: k.provider,
        api_key_preview: k.api_key ? maskKey(k.api_key) : null,
        model_name: k.model_name ?? null,
        daily_limit: k.daily_limit ?? API_KEY_DEFAULTS.DAILY_LIMIT,
        daily_used: k.daily_used ?? 0,
        priority: k.priority ?? 1,
        is_active: k.is_active ?? true,
        last_used_at: k.last_used_at ?? null,
        reset_at: k.reset_at ?? null,
        updated_at: k.updated_at ?? null,
        created_at: k._creationTime,
      }));
  },
});

export const create = mutation({
  args: {
    provider: v.string(),
    api_key: v.string(),
    model_name: v.optional(v.string()),
    daily_limit: v.optional(v.number()),
    priority: v.optional(v.number()),
    is_active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const id = await ctx.db.insert("api_keys", {
      provider: args.provider,
      api_key: args.api_key,
      model_name: args.model_name,
      daily_limit: args.daily_limit ?? API_KEY_DEFAULTS.DAILY_LIMIT,
      daily_used: 0,
      priority: args.priority ?? 1,
      is_active: args.is_active ?? true,
      reset_at: Date.now() + API_KEY_DEFAULTS.RESET_INTERVAL_MS,
      updated_at: Date.now(),
    });

    return { id, api_key_preview: maskKey(args.api_key) };
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
    await requireAdmin(ctx);

    const { id, ...updates } = args;
    const updateData: Record<string, unknown> = { ...updates, updated_at: Date.now() };
    if (updates.api_key === undefined) delete updateData.api_key;
    if (updates.model_name === undefined) delete updateData.model_name;
    if (updates.daily_limit === undefined) delete updateData.daily_limit;
    if (updates.priority === undefined) delete updateData.priority;
    if (updates.is_active === undefined) delete updateData.is_active;

    await ctx.db.patch(id, updateData);
    return { id };
  },
});

export const remove = mutation({
  args: { id: v.id("api_keys") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

export const getUsageStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

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
        is_active: k.is_active ?? true,
      })),
      recent_usage: todayUsage
        .slice(-50)
        .reverse()
        .map((u) => ({
          id: u._id,
          provider: u.provider,
          model_name: u.model_name,
          tokens_used: u.tokens_used || 0,
          success: u.success || false,
          created_at: new Date(u.created_at || u._creationTime).toISOString(),
          response_time_ms: u.response_time_ms || null,
          error_message: u.error_message || null,
        })),
    };
  },
});

export const getAvailableInternal = internalMutation({
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
      if (resetAt < Date.now()) {
        await ctx.db.patch(key._id, {
          daily_used: 0,
          reset_at: Date.now() + API_KEY_DEFAULTS.RESET_INTERVAL_MS,
          updated_at: Date.now(),
        });
        key.daily_used = 0;
      }

      const limit = key.daily_limit ?? API_KEY_DEFAULTS.DAILY_LIMIT;
      if ((key.daily_used || 0) < limit) {
        return key;
      }
    }

    return keys[0];
  },
});

export const incrementUsageInternal = internalMutation({
  args: {
    keyId: v.id("api_keys"),
    tokenCount: v.number(),
  },
  handler: async (ctx, args) => {
    const key = await ctx.db.get(args.keyId);
    if (!key) return;

    await ctx.db.patch(args.keyId, {
      daily_used: (key.daily_used || 0) + args.tokenCount,
      last_used_at: Date.now(),
      updated_at: Date.now(),
    });
  },
});

export const seedApiKeyInternal = internalMutation({
  args: {
    provider: v.string(),
    api_key: v.string(),
    model_name: v.optional(v.string()),
    daily_limit: v.optional(v.number()),
    priority: v.optional(v.number()),
    is_active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("api_keys")
      .withIndex("by_provider_priority", (q) => q.eq("provider", args.provider))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        api_key: args.api_key,
        model_name: args.model_name,
        daily_limit: args.daily_limit ?? API_KEY_DEFAULTS.DAILY_LIMIT,
        priority: args.priority ?? 1,
        is_active: args.is_active ?? true,
        updated_at: Date.now(),
      });
      return { id: existing._id, action: "updated" };
    }

    const id = await ctx.db.insert("api_keys", {
      provider: args.provider,
      api_key: args.api_key,
      model_name: args.model_name,
      daily_limit: args.daily_limit ?? API_KEY_DEFAULTS.DAILY_LIMIT,
      daily_used: 0,
      priority: args.priority ?? 1,
      is_active: args.is_active ?? true,
      reset_at: Date.now() + API_KEY_DEFAULTS.RESET_INTERVAL_MS,
      updated_at: Date.now(),
    });

    return { id, action: "created" };
  },
});



