import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// 获取用户所有关键引用
export const getQuotes = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db.query("users").withIndex("by_token", q => q.eq("tokenIdentifier", identity.tokenIdentifier)).first();
    if (!user) throw new Error("User not found");

    return await ctx.db
      .query("key_quotes")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .collect();
  },
});

// 按主题筛选引用
export const getByTopic = query({
  args: { topic: v.string() },
  handler: async (ctx: QueryCtx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db.query("users").withIndex("by_token", q => q.eq("tokenIdentifier", identity.tokenIdentifier)).first();
    if (!user) throw new Error("User not found");

    return await ctx.db
      .query("key_quotes")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .filter((q) => q.eq(q.field("topic"), args.topic))
      .collect();
  },
});

// 按情感筛选引用
export const getByEmotion = query({
  args: { emotion: v.string() },
  handler: async (ctx: QueryCtx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db.query("users").withIndex("by_token", q => q.eq("tokenIdentifier", identity.tokenIdentifier)).first();
    if (!user) throw new Error("User not found");

    return await ctx.db
      .query("key_quotes")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .filter((q) => q.eq(q.field("emotion"), args.emotion))
      .collect();
  },
});

// 添加新引用
export const addQuote = mutation({
  args: {
    quote: v.string(),
    context: v.optional(v.string()),
    emotion: v.optional(v.string()),
    topic: v.optional(v.string()),
    conversationId: v.optional(v.id("conversations")),
  },
  handler: async (ctx: MutationCtx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db.query("users").withIndex("by_token", q => q.eq("tokenIdentifier", identity.tokenIdentifier)).first();
    if (!user) throw new Error("User not found");

    return await ctx.db.insert("key_quotes", {
      user_id: user._id,
      conversation_id: args.conversationId,
      quote: args.quote,
      context: args.context,
      emotion: args.emotion,
      topic: args.topic,
    });
  },
});

// 更新引用
export const updateQuote = mutation({
  args: {
    quoteId: v.id("key_quotes"),
    quote: v.optional(v.string()),
    context: v.optional(v.string()),
    emotion: v.optional(v.string()),
    topic: v.optional(v.string()),
  },
  handler: async (ctx: MutationCtx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db.query("users").withIndex("by_token", q => q.eq("tokenIdentifier", identity.tokenIdentifier)).first();
    if (!user) throw new Error("User not found");

    const existing = await ctx.db.get(args.quoteId);
    if (!existing) throw new Error("Quote not found");
    if (existing.user_id !== user._id) throw new Error("Forbidden");

    const updates: any = {};
    if (args.quote !== undefined) updates.quote = args.quote;
    if (args.context !== undefined) updates.context = args.context;
    if (args.emotion !== undefined) updates.emotion = args.emotion;
    if (args.topic !== undefined) updates.topic = args.topic;

    await ctx.db.patch(args.quoteId, updates);
  },
});

// 删除引用
export const removeQuote = mutation({
  args: { quoteId: v.id("key_quotes") },
  handler: async (ctx: MutationCtx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db.query("users").withIndex("by_token", q => q.eq("tokenIdentifier", identity.tokenIdentifier)).first();
    if (!user) throw new Error("User not found");

    const existing = await ctx.db.get(args.quoteId);
    if (!existing) throw new Error("Quote not found");
    if (existing.user_id !== user._id) throw new Error("Forbidden");

    await ctx.db.delete(args.quoteId);
  },
});
