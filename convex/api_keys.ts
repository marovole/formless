import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * API key defaults
 * Note: Duplicated from lib/constants since Convex runs in separate environment
 */
const API_KEY_DEFAULTS = {
  DAILY_LIMIT: 1000,
  RESET_INTERVAL_MS: 24 * 60 * 60 * 1000, // 24 hours
} as const;

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
                reset_at: Date.now() + API_KEY_DEFAULTS.RESET_INTERVAL_MS
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

export const incrementUsage = mutation({
  args: {
      keyId: v.id("api_keys"),
      tokenCount: v.number()
  },
  handler: async (ctx, args) => {
      const key = await ctx.db.get(args.keyId);
      if (key) {
          await ctx.db.patch(args.keyId, {
              daily_used: (key.daily_used || 0) + args.tokenCount,
              last_used_at: Date.now()
          });
      }
  }
});
