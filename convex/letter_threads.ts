import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireCurrentUser } from "./_lib/auth";
import type { Doc, Id } from "./_generated/dataModel";

const LETTER_LIMITS = {
  DAILY_MAX: 3,
  PREVIEW_LENGTH: 180,
} as const;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function dayKeyFromTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function buildPairKey(a: Id<"users">, b: Id<"users">): string {
  return String(a) < String(b) ? `${a}:${b}` : `${b}:${a}`;
}

function orderPair(a: Id<"users">, b: Id<"users">): [Id<"users">, Id<"users">] {
  return String(a) < String(b) ? [a, b] : [b, a];
}

function getOtherParticipant(thread: Doc<"letter_threads">, userId: Id<"users">) {
  return thread.user_a_id === userId ? thread.user_b_id : thread.user_a_id;
}

async function assertDailyQuota(ctx: MutationCtx, senderId: Id<"users">, dayKey: string) {
  const sentToday = await ctx.db
    .query("letters")
    .withIndex("by_sender_day", (q) =>
      q.eq("sender_id", senderId).eq("day_key", dayKey),
    )
    .collect();

  if (sentToday.length >= LETTER_LIMITS.DAILY_MAX) {
    throw new Error("Daily letter limit reached");
  }
}

async function insertLetterAndUpdateThread(
  ctx: MutationCtx,
  thread: Doc<"letter_threads">,
  senderId: Id<"users">,
  recipientId: Id<"users">,
  body: string,
  now: number,
) {
  const dayKey = dayKeyFromTimestamp(now);
  await assertDailyQuota(ctx, senderId, dayKey);

  await ctx.db.insert("letters", {
    thread_id: thread._id,
    sender_id: senderId,
    recipient_id: recipientId,
    body,
    day_key: dayKey,
    created_at: now,
  });

  await ctx.db.patch(thread._id, {
    last_letter_at: now,
    last_sender_id: senderId,
    next_sender_id: recipientId,
    last_letter_preview: body.slice(0, LETTER_LIMITS.PREVIEW_LENGTH),
    updated_at: now,
  });
}

export const listForCurrentUser = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx: QueryCtx, args) => {
    const user = await requireCurrentUser(ctx);
    const limit = args.limit ?? 50;

    const fromA = await ctx.db
      .query("letter_threads")
      .withIndex("by_user_a_last_letter", (q) => q.eq("user_a_id", user._id))
      .order("desc")
      .take(limit);

    const fromB = await ctx.db
      .query("letter_threads")
      .withIndex("by_user_b_last_letter", (q) => q.eq("user_b_id", user._id))
      .order("desc")
      .take(limit);

    const merged = [...fromA, ...fromB];
    const byId = new Map<string, any>();
    for (const thread of merged) {
      byId.set(String(thread._id), thread);
    }

    const sorted = [...byId.values()].sort(
      (a, b) => (b.last_letter_at || 0) - (a.last_letter_at || 0),
    );

    const limited = sorted.slice(0, limit);

    return await Promise.all(
      limited.map(async (thread) => {
        const otherId = getOtherParticipant(thread, user._id);
        const counterpart = await ctx.db.get(otherId);
        return {
          _id: thread._id,
          subject: thread.subject ?? "",
          last_letter_at: thread.last_letter_at,
          last_letter_preview: thread.last_letter_preview ?? "",
          canSend: thread.next_sender_id === user._id,
          counterpart: counterpart
            ? {
                full_name: counterpart.full_name ?? "",
                email: counterpart.email,
                avatar_url: counterpart.avatar_url ?? "",
              }
            : null,
        };
      }),
    );
  },
});

export const getThread = query({
  args: { threadId: v.id("letter_threads") },
  handler: async (ctx: QueryCtx, args) => {
    const user = await requireCurrentUser(ctx);
    const thread = await ctx.db.get(args.threadId);
    if (!thread) return null;
    if (thread.user_a_id !== user._id && thread.user_b_id !== user._id) {
      throw new Error("Forbidden");
    }

    const otherId = getOtherParticipant(thread, user._id);
    const counterpart = await ctx.db.get(otherId);

    return {
      thread,
      currentUserId: user._id,
      canSend: thread.next_sender_id === user._id,
      counterpart: counterpart
        ? {
            full_name: counterpart.full_name ?? "",
            email: counterpart.email,
            avatar_url: counterpart.avatar_url ?? "",
          }
        : null,
    };
  },
});

export const createWithLetter = mutation({
  args: {
    recipientEmail: v.string(),
    subject: v.optional(v.string()),
    body: v.string(),
  },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireCurrentUser(ctx);
    const recipientEmail = normalizeEmail(args.recipientEmail);
    const subject = args.subject?.trim();
    const body = args.body.trim();

    if (!body) {
      throw new Error("Letter body is required");
    }

    const recipient = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", recipientEmail))
      .first();

    if (!recipient) {
      throw new Error("Recipient not found");
    }

    if (recipient._id === user._id) {
      throw new Error("Cannot send a letter to yourself");
    }

    const pairKey = buildPairKey(user._id, recipient._id);
    const existingThread = await ctx.db
      .query("letter_threads")
      .withIndex("by_pair_key", (q) => q.eq("pair_key", pairKey))
      .first();

    const now = Date.now();

    if (existingThread) {
      if (existingThread.next_sender_id !== user._id) {
        throw new Error("Waiting for the other person's reply");
      }

      if (!existingThread.subject && subject) {
        await ctx.db.patch(existingThread._id, { subject });
      }

      await insertLetterAndUpdateThread(
        ctx,
        existingThread,
        user._id,
        recipient._id,
        body,
        now,
      );

      return existingThread._id;
    }

    const dayKey = dayKeyFromTimestamp(now);
    await assertDailyQuota(ctx, user._id, dayKey);

    const [userA, userB] = orderPair(user._id, recipient._id);
    const threadId = await ctx.db.insert("letter_threads", {
      user_a_id: userA,
      user_b_id: userB,
      pair_key: pairKey,
      subject,
      last_letter_at: now,
      last_sender_id: user._id,
      next_sender_id: recipient._id,
      last_letter_preview: body.slice(0, LETTER_LIMITS.PREVIEW_LENGTH),
      updated_at: now,
    });

    await ctx.db.insert("letters", {
      thread_id: threadId,
      sender_id: user._id,
      recipient_id: recipient._id,
      body,
      day_key: dayKey,
      created_at: now,
    });

    return threadId;
  },
});

export const reply = mutation({
  args: {
    threadId: v.id("letter_threads"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }
    if (thread.user_a_id !== user._id && thread.user_b_id !== user._id) {
      throw new Error("Forbidden");
    }
    if (thread.next_sender_id !== user._id) {
      throw new Error("Waiting for the other person's reply");
    }

    const body = args.body.trim();
    if (!body) {
      throw new Error("Letter body is required");
    }

    const recipientId = getOtherParticipant(thread, user._id);
    await insertLetterAndUpdateThread(ctx, thread, user._id, recipientId, body, Date.now());
  },
});
