import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireCurrentUser } from "./_lib/auth";

export type AgentMemoryCategory =
  | "concern"
  | "preference"
  | "life_event"
  | "emotion_pattern";

export const listRecent = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const limit = Math.min(args.limit ?? 10, 50);

    const memories = await ctx.db
      .query("agent_memories")
      .withIndex("by_user_archived", (q) => q.eq("user_id", user._id).eq("archived", false))
      .order("desc")
      .take(limit);

    return memories.map((m) => ({
      ...m,
      id: m._id,
      created_at: new Date(m._creationTime).toISOString(),
    }));
  },
});

export const count = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const memories = await ctx.db
      .query("agent_memories")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .collect();

    return {
      total: memories.length,
      active: memories.filter((m) => !m.archived).length,
    };
  },
});

export const save = mutation({
  args: {
    category: v.string(),
    content: v.string(),
    importance: v.number(),
    sourceConversationId: v.optional(v.id("conversations")),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const content = args.content.trim();
    if (!content) return null;

    const importance = Math.max(1, Math.min(10, Math.round(args.importance)));

    const existing = await ctx.db
      .query("agent_memories")
      .withIndex("by_user_category", (q) => q.eq("user_id", user._id).eq("category", args.category))
      .filter((q) => q.eq(q.field("content"), content))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        importance: Math.max(existing.importance ?? 1, importance),
        last_referenced: now,
        archived: false,
      });
      return existing._id;
    }

    return await ctx.db.insert("agent_memories", {
      user_id: user._id,
      category: args.category,
      content: content.slice(0, 800),
      importance,
      last_referenced: now,
      source_conversation: args.sourceConversationId,
      archived: false,
    });
  },
});

export const recall = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const limit = Math.min(args.limit ?? 5, 20);
    const q = args.query.trim().toLowerCase();
    if (!q) return [];

    const memories = await ctx.db
      .query("agent_memories")
      .withIndex("by_user_archived", (qq) => qq.eq("user_id", user._id).eq("archived", false))
      .collect();

    const scored = memories
      .map((m) => {
        const text = `${m.category} ${m.content}`.toLowerCase();
        const hit = text.includes(q);
        const score = (hit ? 100 : 0) + (m.importance ?? 0);
        return { m, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map((x) => ({
      id: x.m._id,
      category: x.m.category,
      content: x.m.content,
      importance: x.m.importance,
    }));
  },
});

export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const memories = await ctx.db
      .query("agent_memories")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .collect();

    for (const m of memories) {
      await ctx.db.delete(m._id);
    }

    const profile = ((user.profile || {}) as Record<string, unknown>) ?? {};
    const updatedProfile = {
      ...profile,
      tags: [],
      recurring_topics: [],
      communication_style: null,
      last_mood: null,
      active_concerns: [],
      last_memory_update: new Date().toISOString(),
    };

    await ctx.db.patch(user._id, { profile: updatedProfile, updated_at: Date.now() });
    return { deleted: memories.length };
  },
});
