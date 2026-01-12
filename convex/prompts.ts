import { query } from "./_generated/server";
import { v } from "convex/values";

export const getActive = query({
  args: {
      role: v.string(),
      language: v.string()
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("prompts")
      .withIndex("by_role_language", (q) => q.eq("role", args.role).eq("language", args.language))
      .filter((q) => q.eq(q.field("is_active"), true))
      .first();
  }
});
