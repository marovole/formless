import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./_lib/auth";

export const listUsers = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.query("users").order("desc").take(args.limit ?? 100);
  },
});

