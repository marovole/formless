import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// 获取用户所有关键引用
export const getQuotes = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    return await ctx.db
      .query("keyQuotes")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
  },
});

// 按主题筛选引用
export const getByTopic = query({
  args: { topic: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const quotes = await ctx.db
      .query("keyQuotes")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    return quotes.filter((q) => q.topic === args.topic);
  },
});

// 按情感筛选引用
export const getByEmotion = query({
  args: { emotion: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const quotes = await ctx.db
      .query("keyQuotes")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    return quotes.filter((q) => q.emotion === args.emotion);
  },
});

// 添加新引用
export const addQuote = mutation({
  args: {
    quote: v.string(),
    context: v.optional(v.string()),
    emotion: v.optional(v.string()),
    topic: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    return await ctx.db.insert("keyQuotes", {
      userId: identity.subject,
      quote: args.quote,
      context: args.context,
      emotion: args.emotion,
      topic: args.topic,
      createdAt: Date.now(),
    });
  },
});

// 更新引用
export const updateQuote = mutation({
  args: {
    quoteId: v.id("keyQuotes"),
    quote: v.optional(v.string()),
    context: v.optional(v.string()),
    emotion: v.optional(v.string()),
    topic: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const existing = await ctx.db.get(args.quoteId);
    if (!existing) throw new Error("Quote not found");
    if (existing.userId !== identity.subject) throw new Error("Forbidden");

    const updates: Record<string, unknown> = {};
    if (args.quote !== undefined) updates.quote = args.quote;
    if (args.context !== undefined) updates.context = args.context;
    if (args.emotion !== undefined) updates.emotion = args.emotion;
    if (args.topic !== undefined) updates.topic = args.topic;

    await ctx.db.patch(args.quoteId, updates);
  },
});

// 删除引用
export const removeQuote = mutation({
  args: { quoteId: v.id("keyQuotes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const existing = await ctx.db.get(args.quoteId);
    if (!existing) throw new Error("Quote not found");
    if (existing.userId !== identity.subject) throw new Error("Forbidden");

    await ctx.db.delete(args.quoteId);
  },
});
