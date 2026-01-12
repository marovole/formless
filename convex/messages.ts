import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// 获取对话中的所有消息
export const listByConversation = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // 验证 conversation 归属
    const conv = await ctx.db.get(args.conversationId);
    if (!conv) throw new Error("Conversation not found");
    if (conv.userId !== identity.subject) throw new Error("Forbidden");

    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .collect();
  },
});

// 添加消息到对话
export const append = mutation({
  args: {
    conversationId: v.id("conversations"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    tokens: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // 验证权限
    const conv = await ctx.db.get(args.conversationId);
    if (!conv) throw new Error("Conversation not found");
    if (conv.userId !== identity.subject) throw new Error("Forbidden");

    await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: args.role,
      content: args.content,
      tokens: args.tokens,
    });

    // 更新 conversation
    await ctx.db.patch(args.conversationId, {
      messageCount: conv.messageCount + 1,
      updatedAt: Date.now(),
    });
  },
});

// 删除消息
export const remove = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error("Message not found");

    // 验证 conversation 归属
    const conv = await ctx.db.get(msg.conversationId);
    if (!conv) throw new Error("Conversation not found");
    if (conv.userId !== identity.subject) throw new Error("Forbidden");

    await ctx.db.delete(args.messageId);

    // 更新 conversation 消息计数
    await ctx.db.patch(msg.conversationId, {
      messageCount: Math.max(0, conv.messageCount - 1),
      updatedAt: Date.now(),
    });
  },
});

// 清空对话中的所有消息
export const clear = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // 验证权限
    const conv = await ctx.db.get(args.conversationId);
    if (!conv) throw new Error("Conversation not found");
    if (conv.userId !== identity.subject) throw new Error("Forbidden");

    // 删除所有消息
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }

    // 重置对话消息计数
    await ctx.db.patch(args.conversationId, {
      messageCount: 0,
      updatedAt: Date.now(),
    });
  },
});
