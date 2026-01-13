import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const log = mutation({
  args: {
    apiKeyId: v.optional(v.id("api_keys")),
    provider: v.string(),
    modelName: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    conversationId: v.optional(v.id("conversations")),
    tokensUsed: v.optional(v.number()),
    success: v.optional(v.boolean()),
    errorMessage: v.optional(v.string()),
    responseTimeMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("api_usage", {
      api_key_id: args.apiKeyId,
      provider: args.provider,
      model_name: args.modelName,
      user_id: args.userId,
      conversation_id: args.conversationId,
      tokens_used: args.tokensUsed,
      success: args.success,
      error_message: args.errorMessage,
      response_time_ms: args.responseTimeMs,
      created_at: Date.now(),
    });
  }
});
