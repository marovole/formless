import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_conversation_id", (q) => q.eq("conversation_id", args.conversationId))
      .collect();
  },
});

export const insert = mutation({
  args: {
    conversationId: v.id("conversations"),
    role: v.string(),
    content: v.string(),
    tokens: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("messages", {
      conversation_id: args.conversationId,
      role: args.role,
      content: args.content,
      tokens: args.tokens,
    });

    const conversation = await ctx.db.get(args.conversationId);
    if (conversation) {
        await ctx.db.patch(args.conversationId, {
            message_count: (conversation.message_count || 0) + 1,
            last_message_at: Date.now(),
            updated_at: Date.now(),
        });
    }
  },
});
