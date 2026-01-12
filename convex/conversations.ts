import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Internal mutation called by server action/API
export const createInternal = mutation({
  args: {
    userId: v.id("users"),
    language: v.optional(v.string()),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("conversations", {
      user_id: args.userId,
      language: args.language,
      title: args.title,
      message_count: 0,
      updated_at: Date.now(),
      last_message_at: Date.now(),
    });
  },
});

export const get = query({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) return [];

    const limit = args.limit || 20;

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user_last_message", (q) => q.eq("user_id", user._id))
      .order("desc")
      .take(limit);

    return await Promise.all(conversations.map(async (conv) => {
        const lastMsg = await ctx.db.query("messages")
            .withIndex("by_conversation_id", q => q.eq("conversation_id", conv._id))
            .order("desc")
            .first();

        return {
            ...conv,
            preview: lastMsg?.content.slice(0, 100) || conv.title || "",
        };
    }));
  },
});

export const listInternal = query({
  args: { clerkId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) return [];

    const limit = args.limit || 20;

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user_last_message", (q) => q.eq("user_id", user._id))
      .order("desc")
      .take(limit);

    return await Promise.all(conversations.map(async (conv) => {
        const lastMsg = await ctx.db.query("messages")
            .withIndex("by_conversation_id", q => q.eq("conversation_id", conv._id))
            .order("desc")
            .first();

        return {
            ...conv,
            preview: lastMsg?.content.slice(0, 100) || conv.title || "",
        };
    }));
  }
});

export const deleteConversation = mutation({
  args: { id: v.id("conversations"), clerkId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let userId: Id<"users">;

    if (args.clerkId) {
         const user = await ctx.db.query("users").withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId!)).first();
         if (!user) throw new Error("User not found");
         userId = user._id;
    } else {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthorized");
        const user = await ctx.db.query("users").withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject)).first();
        if (!user) throw new Error("User not found");
        userId = user._id;
    }

    const conversation = await ctx.db.get(args.id);
    if (!conversation) throw new Error("Conversation not found");
    if (conversation.user_id !== userId) throw new Error("Forbidden");

    // Delete messages
    const messages = await ctx.db.query("messages").withIndex("by_conversation_id", (q) => q.eq("conversation_id", args.id)).collect();
    for (const msg of messages) {
        await ctx.db.delete(msg._id);
    }

    // Delete api_usage
    const apiUsages = await ctx.db.query("api_usage").withIndex("by_conversation_id", (q) => q.eq("conversation_id", args.id)).collect();
    for (const u of apiUsages) {
        await ctx.db.delete(u._id);
    }

    // key_quotes
    const quotes = await ctx.db.query("key_quotes").withIndex("by_conversation_id", (q) => q.eq("conversation_id", args.id)).collect();
    for (const q of quotes) {
        await ctx.db.delete(q._id);
    }

    await ctx.db.delete(args.id);
  }
});
