import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const log = mutation({
  args: {
    apiKeyId: v.optional(v.id("api_keys")),
    provider: v.string(),
    userId: v.optional(v.id("users")),
    tokensUsed: v.optional(v.number()),
    success: v.optional(v.boolean()),
    errorMessage: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("api_usage", {
        api_key_id: args.apiKeyId,
        provider: args.provider,
        user_id: args.userId,
        tokens_used: args.tokensUsed,
        success: args.success,
        error_message: args.errorMessage,
        // created_at is handled by _creationTime
    });
  }
});
