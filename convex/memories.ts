import { query, mutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { requireCurrentUser } from "./_lib/auth";
import { api, internal } from "./_generated/api";

export const list = query({
  args: {
    conversationId: v.optional(v.id("conversations")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const limit = Math.min(args.limit ?? 50, 200);

    let quotes: Doc<"key_quotes">[] = [];

    if (args.conversationId) {
      const conversation = await ctx.db.get(args.conversationId);
      if (!conversation || conversation.user_id !== user._id) {
        return { quotes: [], insights: getInsights(user) };
      }

      quotes = await ctx.db
        .query("key_quotes")
        .withIndex("by_conversation_id", (q) =>
          q.eq("conversation_id", args.conversationId),
        )
        .order("desc")
        .take(limit);
    } else {
      quotes = await ctx.db
        .query("key_quotes")
        .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
        .order("desc")
        .take(limit);
    }

    return {
      quotes: quotes.map((q) => ({
        ...q,
        id: q._id,
        created_at: new Date(q._creationTime).toISOString(),
      })),
      insights: getInsights(user),
    };
  },
});

function getInsights(user: Doc<"users">) {
  const profile = (user.profile || {}) as Record<string, unknown>;
  return {
    personality: (profile.personality as string | undefined) || null,
    interests: (profile.interests as string[] | undefined) || [],
    concerns: (profile.concerns as string[] | undefined) || [],
  };
}

export const prepareExtraction = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");
    if (conversation.user_id !== user._id) throw new Error("Forbidden");

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversation_id", args.conversationId),
      )
      .order("asc")
      .collect();

    return {
      userId: user._id,
      conversationText: messages.map((m) => `${m.role}: ${m.content}`).join("\n"),
    };
  },
});

export const saveExtracted = mutation({
  args: {
    conversationId: v.id("conversations"),
    quotes: v.array(v.string()),
    insights: v.optional(
      v.object({
        personality: v.optional(v.string()),
        interests: v.optional(v.array(v.string())),
        concerns: v.optional(v.array(v.string())),
        emotion: v.optional(v.string()),
        topic: v.optional(v.string()),
      }),
    ),
    context: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");
    if (conversation.user_id !== user._id) throw new Error("Forbidden");

    for (const quote of args.quotes) {
      const existing = await ctx.db
        .query("key_quotes")
        .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
        .filter((q) =>
          q.and(
            q.eq(q.field("conversation_id"), args.conversationId),
            q.eq(q.field("quote"), quote),
          ),
        )
        .first();

      if (!existing) {
        await ctx.db.insert("key_quotes", {
          user_id: user._id,
          conversation_id: args.conversationId,
          quote,
          context: args.context.slice(0, 500),
          emotion: args.insights?.emotion,
          topic: args.insights?.topic,
        });
      }
    }

    if (args.insights) {
      const currentProfile = (user.profile || {}) as Record<string, unknown>;
      const updatedProfile = {
        ...currentProfile,
        personality: args.insights.personality || currentProfile.personality,
        interests: args.insights.interests || currentProfile.interests || [],
        concerns: args.insights.concerns || currentProfile.concerns || [],
        last_memory_update: new Date().toISOString(),
      };
      await ctx.db.patch(user._id, { profile: updatedProfile, updated_at: Date.now() });
    }
  },
});

export const extractFromConversation = internalAction({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const { userId, conversationText } = (await ctx.runMutation(
      api.memories.prepareExtraction,
      { conversationId: args.conversationId },
    )) as { userId: string; conversationText: string };

    const prompt = buildExtractionPrompt(conversationText);

    const apiKey = await ctx.runMutation(internal.api_keys.getAvailableInternal, {
      provider: "openrouter",
    });

    if (!apiKey) {
      throw new Error("No available API key for memory extraction");
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.api_key}`,
      },
      body: JSON.stringify({
        model: apiKey.model_name || "mistralai/devstral-2512:free",
        messages: [
          {
            role: "system",
            content:
              "You extract user memories from conversations and respond with valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        stream: false,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as any;
    const content = data?.choices?.[0]?.message?.content as string | undefined;
    if (!content) {
      throw new Error("Empty memory extraction response");
    }

    const parsed = parseJsonObject(content);
    if (!parsed) {
      throw new Error("Failed to parse memory extraction JSON");
    }

    await ctx.runMutation(api.memories.saveExtracted, {
      conversationId: args.conversationId,
      quotes: Array.isArray(parsed.key_quotes) ? parsed.key_quotes : [],
      insights: parsed.insights,
      context: conversationText,
    });

    await ctx.runMutation(internal.api_keys.incrementUsageInternal, {
      keyId: apiKey._id,
      tokenCount: estimateTokenCount(content),
    });

    await ctx.runMutation(internal.api_usage.logInternal, {
      apiKeyId: apiKey._id,
      provider: "openrouter",
      modelName: apiKey.model_name,
      userId,
      conversationId: args.conversationId,
      tokensUsed: estimateTokenCount(content),
      success: true,
    });
  },
});

function buildExtractionPrompt(conversationText: string): string {
  return `Analyze the conversation and extract durable user information. Reply with valid JSON only.\n\nSchema:\n{\n  \"key_quotes\": [\"string\"],\n  \"insights\": {\n    \"personality\": \"string\",\n    \"interests\": [\"string\"],\n    \"concerns\": [\"string\"],\n    \"emotion\": \"string\",\n    \"topic\": \"string\"\n  }\n}\n\nConversation:\n${conversationText}`;
}

function parseJsonObject(raw: string): any | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function estimateTokenCount(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const other = Math.max(0, text.length - cjk);
  return cjk + Math.ceil(other / 4);
}
