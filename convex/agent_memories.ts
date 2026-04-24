import {
  mutation,
  query,
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { requireCurrentUser } from "./_lib/auth";
import { api, internal } from "./_generated/api";
import type { Id, Doc } from "./_generated/dataModel";

const EMBEDDING_DIMENSIONS = 1536;
const RECALL_SCORE_THRESHOLD = 0.35;
const MAX_CROSS_SESSION_TOP_K = 10;

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
      // Only (re)generate embedding if the existing row is missing one —
      // content hasn't changed, so the old vector (if present) is still valid.
      if (!existing.embedding) {
        await ctx.scheduler.runAfter(0, internal.agent_memories.generateEmbedding, {
          memoryId: existing._id,
        });
      }
      return existing._id;
    }

    const insertedId = await ctx.db.insert("agent_memories", {
      user_id: user._id,
      category: args.category,
      content: content.slice(0, 800),
      importance,
      last_referenced: now,
      source_conversation: args.sourceConversationId,
      archived: false,
    });

    await ctx.scheduler.runAfter(0, internal.agent_memories.generateEmbedding, {
      memoryId: insertedId,
    });

    return insertedId;
  },
});

// ============================================================================
// Embedding generation (async, lazy backfill)
// ============================================================================

export const getForEmbedding = internalQuery({
  args: { memoryId: v.id("agent_memories") },
  handler: async (ctx, { memoryId }) => {
    const memory = await ctx.db.get(memoryId);
    if (!memory) return null;
    return {
      content: memory.content,
      category: memory.category,
      hasEmbedding: Array.isArray(memory.embedding) && memory.embedding.length > 0,
    };
  },
});

export const patchEmbedding = internalMutation({
  args: {
    memoryId: v.id("agent_memories"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, { memoryId, embedding }) => {
    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      // Defensive: reject mis-dimensioned vectors rather than corrupt the index.
      return;
    }
    await ctx.db.patch(memoryId, { embedding });
  },
});

// OpenRouter is the default embedding provider (proxies OpenAI's
// text-embedding-3-small). Set EMBEDDING_PROVIDER=openai in Convex
// environment to hit OpenAI directly.
async function embedForConvex(text: string): Promise<number[] | null> {
  const provider = process.env.EMBEDDING_PROVIDER || "openrouter";
  const useOpenAI = provider === "openai";

  const url = useOpenAI
    ? "https://api.openai.com/v1/embeddings"
    : "https://openrouter.ai/api/v1/embeddings";
  const model = useOpenAI
    ? "text-embedding-3-small"
    : "openai/text-embedding-3-small";

  let apiKey: string | null = null;
  if (useOpenAI) {
    apiKey = process.env.OPENAI_API_KEY ?? null;
  } else {
    const raw = process.env.OPENROUTER_API_KEYS ?? process.env.OPENROUTER_API_KEY ?? "";
    const keys = raw
      .split(",")
      .map((k: string) => k.trim())
      .filter(Boolean);
    if (keys.length > 0) {
      apiKey = keys[Math.floor(Date.now() / 1000) % keys.length];
    }
  }

  if (!apiKey) return null;

  const run = async (): Promise<number[] | null> => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, input: text }),
    });

    if (!response.ok) {
      if (response.status === 429 || response.status === 503) {
        throw new Error(`retryable:${response.status}`);
      }
      return null;
    }

    const json = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
    const vec = json.data?.[0]?.embedding;
    if (!Array.isArray(vec) || vec.length === 0) return null;
    return vec;
  };

  try {
    return await run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.startsWith("retryable")) return null;
    await new Promise((r) => setTimeout(r, 250));
    try {
      return await run();
    } catch {
      return null;
    }
  }
}

export const generateEmbedding = internalAction({
  args: { memoryId: v.id("agent_memories") },
  handler: async (ctx, { memoryId }): Promise<void> => {
    const record = await ctx.runQuery(internal.agent_memories.getForEmbedding, { memoryId });
    if (!record || record.hasEmbedding) return;

    // Prepend category to give the vector extra structural signal
    // (e.g. "life_event: 父亲上月离世..." clusters better than bare content).
    const text = `${record.category}: ${record.content}`;
    const embedding = await embedForConvex(text);

    if (!embedding) return; // Silent miss — next save or backfill will retry.

    await ctx.runMutation(internal.agent_memories.patchEmbedding, {
      memoryId,
      embedding,
    });
  },
});

// ============================================================================
// Semantic recall (vector search)
// ============================================================================

interface RecalledMemory {
  id: Id<"agent_memories">;
  category: string;
  content: string;
  importance: number;
  score: number;
}

export const hydrateRecalled = internalQuery({
  args: { ids: v.array(v.id("agent_memories")) },
  handler: async (ctx, { ids }) => {
    const docs = await Promise.all(ids.map((id) => ctx.db.get(id)));
    return docs.filter((d): d is Doc<"agent_memories"> => d !== null);
  },
});

export const recallByEmbedding = action({
  args: {
    embedding: v.array(v.float64()),
    topK: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<RecalledMemory[]> => {
    if (args.embedding.length !== EMBEDDING_DIMENSIONS) return [];

    const user = await ctx.runQuery(api.users.getCurrent, {});
    if (!user) return [];

    const topK = Math.max(1, Math.min(args.topK ?? 3, MAX_CROSS_SESSION_TOP_K));

    const results = await ctx.vectorSearch("agent_memories", "by_embedding", {
      vector: args.embedding,
      limit: topK,
      filter: (q) => q.eq("user_id", user._id),
    });

    const hits = results.filter((r) => r._score >= RECALL_SCORE_THRESHOLD);
    if (hits.length === 0) return [];

    const docs = await ctx.runQuery(internal.agent_memories.hydrateRecalled, {
      ids: hits.map((h) => h._id),
    });

    const scoreById = new Map(hits.map((h) => [h._id, h._score]));

    return docs
      .filter((d) => !d.archived)
      .map((d) => ({
        id: d._id,
        category: d.category,
        content: d.content,
        importance: d.importance,
        score: scoreById.get(d._id) ?? 0,
      }))
      .sort((a, b) => b.score - a.score);
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

    const profile = user.profile || {};
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
