import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireCurrentUser } from "./_lib/auth";

export const listByConversation = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return [];
    if (conversation.user_id !== user._id) {
      throw new Error("Forbidden");
    }

    return await ctx.db
      .query("messages")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversation_id", args.conversationId),
      )
      .order("asc")
      .collect();
  },
});

export const append = mutation({
  args: {
    conversationId: v.id("conversations"),
    role: v.string(),
    content: v.string(),
    tokens: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }
    if (conversation.user_id !== user._id) {
      throw new Error("Forbidden");
    }

    await ctx.db.insert("messages", {
      conversation_id: args.conversationId,
      role: args.role,
      content: args.content,
      tokens: args.tokens,
    });

    await ctx.db.patch(args.conversationId, {
      message_count: (conversation.message_count || 0) + 1,
      last_message_at: Date.now(),
      updated_at: Date.now(),
    });
  },
});

