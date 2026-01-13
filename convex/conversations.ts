import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireCurrentUser } from "./_lib/auth";

const CONVERSATION_DEFAULTS = {
  LIST_LIMIT: 20,
  PREVIEW_LENGTH: 100,
} as const;

export const create = mutation({
  args: {
    title: v.optional(v.string()),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const now = Date.now();

    return await ctx.db.insert("conversations", {
      user_id: user._id,
      title: args.title,
      language: args.language,
      message_count: 0,
      last_message_at: now,
      updated_at: now,
    });
  },
});

export const get = query({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const conversation = await ctx.db.get(args.id);
    if (!conversation) return null;
    if (conversation.user_id !== user._id) {
      throw new Error("Forbidden");
    }
    return conversation;
  },
});

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const limit = args.limit ?? CONVERSATION_DEFAULTS.LIST_LIMIT;

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user_last_message", (q) => q.eq("user_id", user._id))
      .order("desc")
      .take(limit);

    return await Promise.all(
      conversations.map(async (conv) => {
        const lastMsg = await ctx.db
          .query("messages")
          .withIndex("by_conversation_id", (q) =>
            q.eq("conversation_id", conv._id),
          )
          .order("desc")
          .first();

        return {
          ...conv,
          preview:
            lastMsg?.content.slice(0, CONVERSATION_DEFAULTS.PREVIEW_LENGTH) ||
            conv.title ||
            "",
        };
      }),
    );
  },
});

export const remove = mutation({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const conversation = await ctx.db.get(args.id);
    if (!conversation) {
      return;
    }
    if (conversation.user_id !== user._id) {
      throw new Error("Forbidden");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversation_id", args.id),
      )
      .collect();
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }

    const apiUsages = await ctx.db
      .query("api_usage")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversation_id", args.id),
      )
      .collect();
    for (const usage of apiUsages) {
      await ctx.db.delete(usage._id);
    }

    const quotes = await ctx.db
      .query("key_quotes")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversation_id", args.id),
      )
      .collect();
    for (const quote of quotes) {
      await ctx.db.delete(quote._id);
    }

    const triggerHistory = await ctx.db
      .query("guanzhao_trigger_history")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversation_id", args.id),
      )
      .collect();
    for (const history of triggerHistory) {
      await ctx.db.delete(history._id);
    }

    await ctx.db.delete(args.id);
  },
});
