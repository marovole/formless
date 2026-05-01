import { mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { requireIdentity, requireCurrentUser } from "./_lib/auth";
import { ensureCurrentUserFromIdentity } from "./_lib/ensure_user";

const TITLE_MAX_LENGTH = 50;
const MEMORY_CAP_MAX = 200;
const HISTORY_HARD_CAP = 2000;

function getInsights(user: Doc<"users">) {
  const profile = (user.profile || {}) as Record<string, unknown>;
  return {
    personality: (profile.personality as string | undefined) || null,
    interests: (profile.interests as string[] | undefined) || [],
    concerns: (profile.concerns as string[] | undefined) || [],
  };
}

/**
 * Single round-trip: ensure user row, resolve conversation, load bounded history + key_quotes/insights for chat.
 */
export const prepareChatContext = mutation({
  args: {
    titleSeed: v.string(),
    conversationId: v.optional(v.id("conversations")),
    preferredLanguage: v.optional(v.string()),
    fullName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    memoryLimit: v.number(),
    historyLimit: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const convexUserId = await ensureCurrentUserFromIdentity(ctx, identity, {
      preferredLanguage: args.preferredLanguage,
      fullName: args.fullName,
      avatarUrl: args.avatarUrl,
    });

    const user = await requireCurrentUser(ctx);

    const historyCap = Math.min(Math.max(1, args.historyLimit), HISTORY_HARD_CAP);
    const memoryCap = Math.min(Math.max(1, args.memoryLimit), MEMORY_CAP_MAX);

    let activeConversationId: Id<"conversations">;
    let conversationHistory: Array<{ role: string; content: string }> = [];

    if (args.conversationId) {
      const conv = await ctx.db.get(args.conversationId);
      if (!conv || conv.user_id !== user._id) {
        const now = Date.now();
        activeConversationId = await ctx.db.insert("conversations", {
          user_id: user._id,
          language: args.preferredLanguage ?? "zh",
          title: args.titleSeed.slice(0, TITLE_MAX_LENGTH),
          message_count: 0,
          last_message_at: now,
          updated_at: now,
        });
      } else {
        activeConversationId = args.conversationId;
        const batch = await ctx.db
          .query("messages")
          .withIndex("by_conversation_id", (q) =>
            q.eq("conversation_id", activeConversationId),
          )
          .order("desc")
          .take(historyCap);

        const ordered = batch.reverse();
        conversationHistory = ordered.map((m) => ({
          role: m.role,
          content: m.content,
        }));
      }
    } else {
      const now = Date.now();
      activeConversationId = await ctx.db.insert("conversations", {
        user_id: user._id,
        language: args.preferredLanguage ?? "zh",
        title: args.titleSeed.slice(0, TITLE_MAX_LENGTH),
        message_count: 0,
        last_message_at: now,
        updated_at: now,
      });
    }

    const conversation = await ctx.db.get(activeConversationId);
    let quotes: Doc<"key_quotes">[] = [];
    if (conversation && conversation.user_id === user._id) {
      quotes = await ctx.db
        .query("key_quotes")
        .withIndex("by_conversation_id", (q) =>
          q.eq("conversation_id", activeConversationId),
        )
        .order("desc")
        .take(memoryCap);
    }

    const memorySnapshot = {
      quotes: quotes.map((q) => ({
        ...q,
        id: q._id,
        created_at: new Date(q._creationTime).toISOString(),
      })),
      insights: getInsights(user),
    };

    return {
      convexUserId,
      activeConversationId,
      conversationHistory,
      memorySnapshot,
    };
  },
});
