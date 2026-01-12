import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// 获取用户所有对话列表
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    return await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();
  },
});

// 获取单个对话详情
export const get = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const conv = await ctx.db.get(args.conversationId);
    if (!conv) throw new Error("Conversation not found");
    if (conv.userId !== identity.subject) throw new Error("Forbidden");

    return conv;
  },
});

// 创建新对话
export const create = mutation({
  args: { title: v.string(), language: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    return await ctx.db.insert("conversations", {
      userId: identity.subject,
      title: args.title,
      messageCount: 0,
      language: args.language,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// 更新对话标题
export const updateTitle = mutation({
  args: { conversationId: v.id("conversations"), title: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const conv = await ctx.db.get(args.conversationId);
    if (!conv) throw new Error("Conversation not found");
    if (conv.userId !== identity.subject) throw new Error("Forbidden");

    await ctx.db.patch(args.conversationId, {
      title: args.title,
      updatedAt: Date.now(),
    });
  },
});

// 删除对话
export const remove = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const conv = await ctx.db.get(args.conversationId);
    if (!conv) throw new Error("Conversation not found");
    if (conv.userId !== identity.subject) throw new Error("Forbidden");

    // 删除对话下的所有消息
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }

    // 删除对话
    await ctx.db.delete(args.conversationId);
  },
});
