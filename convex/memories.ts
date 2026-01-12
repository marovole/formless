import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

export const listInternal = query({
  args: {
      clerkId: v.string(),
      conversationId: v.optional(v.id("conversations")),
      limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users").withIndex("by_clerk_id", q => q.eq("clerkId", args.clerkId)).first();
    if (!user) throw new Error("User not found");

    let quotes;
    if (args.conversationId) {
        const conv = await ctx.db.get(args.conversationId);
        if (conv && conv.user_id === user._id) {
             quotes = await ctx.db.query("key_quotes")
                .withIndex("by_conversation_id", q => q.eq("conversation_id", args.conversationId))
                .order("desc")
                .take(args.limit || 100);
        } else {
            quotes = [];
        }
    } else {
        quotes = await ctx.db.query("key_quotes")
            .withIndex("by_user_id", q => q.eq("user_id", user._id))
            .order("desc")
            .take(args.limit || 100);
    }

    return {
        quotes: quotes.map(q => ({
            ...q,
            id: q._id,
            created_at: new Date(q._creationTime).toISOString()
        })),
        insights: {
            personality: user.profile?.personality,
            interests: user.profile?.interests || [],
            concerns: user.profile?.concerns || [],
        }
    };
  }
});

export const prepareExtraction = mutation({
  args: {
    clerkId: v.string(),
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users").withIndex("by_clerk_id", q => q.eq("clerkId", args.clerkId)).first();
    if (!user) throw new Error("Unauthorized");

    const conv = await ctx.db.get(args.conversationId);
    if (!conv || conv.user_id !== user._id) throw new Error("Forbidden");

    const messages = await ctx.db.query("messages")
      .withIndex("by_conversation_id", q => q.eq("conversation_id", args.conversationId))
      .collect();

    return {
      userId: user._id,
      conversationText: messages.map(m => `${m.role}: ${m.content}`).join('\n'),
    };
  }
});

export const saveExtractedMemories = mutation({
  args: {
    userId: v.id("users"),
    conversationId: v.id("conversations"),
    quotes: v.array(v.string()),
    insights: v.optional(v.object({
      personality: v.optional(v.string()),
      interests: v.optional(v.array(v.string())),
      concerns: v.optional(v.array(v.string())),
      emotion: v.optional(v.string()),
      topic: v.optional(v.string()),
    })),
    context: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. 保存引用
    for (const quote of args.quotes) {
        // 检查是否已存在
        const existing = await ctx.db.query("key_quotes")
            .withIndex("by_user_id", q => q.eq("user_id", args.userId))
            .filter(q => q.and(
                q.eq(q.field("conversation_id"), args.conversationId),
                q.eq(q.field("quote"), quote)
            ))
            .first();

        if (!existing) {
            await ctx.db.insert("key_quotes", {
                user_id: args.userId,
                conversation_id: args.conversationId,
                quote,
                context: args.context.slice(0, 500),
                emotion: args.insights?.emotion,
                topic: args.insights?.topic,
            });
        }
    }

    // 2. 更新用户 Profile
    if (args.insights) {
        const user = await ctx.db.get(args.userId);
        if (user) {
            const currentProfile = user.profile || {};
            const updatedProfile = {
                ...currentProfile,
                personality: args.insights.personality || currentProfile.personality,
                interests: args.insights.interests || currentProfile.interests || [],
                concerns: args.insights.concerns || currentProfile.concerns || [],
                last_memory_update: new Date().toISOString(),
            };
            await ctx.db.patch(args.userId, { profile: updatedProfile });
        }
    }
  }
});
