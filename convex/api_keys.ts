import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const getAvailable = mutation({
  args: { provider: v.string() },
  handler: async (ctx, args) => {
    const keys = await ctx.db
      .query("api_keys")
      .withIndex("by_provider_priority", (q) => q.eq("provider", args.provider))
      .filter((q) => q.eq(q.field("is_active"), true))
      .collect();

    if (!keys.length) return null;

    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todayTs = todayStart.getTime();

    for (const key of keys) {
        const resetAt = key.reset_at || 0;
        // Logic: if reset_at is in the past compared to now (and we want to reset daily)
        // Original code checked strict date string match.
        // Here we just check if reset_at < todayTs means it was set before today.
        // Actually reset_at in original was "tomorrow".
        // Let's stick to simple: if last_used_at is not today?
        // Or just trust reset_at.

        if (resetAt < Date.now()) {
             // It's time to reset
             await ctx.db.patch(key._id, {
                daily_used: 0,
                reset_at: Date.now() + 24 * 60 * 60 * 1000
            });
            key.daily_used = 0;
        }

        if ((key.daily_used || 0) < (key.daily_limit || 1000)) {
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
