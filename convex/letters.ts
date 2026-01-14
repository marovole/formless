import { query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireCurrentUser } from "./_lib/auth";

export const listByThread = query({
  args: { threadId: v.id("letter_threads") },
  handler: async (ctx: QueryCtx, args) => {
    const user = await requireCurrentUser(ctx);
    const thread = await ctx.db.get(args.threadId);
    if (!thread) return [];
    if (thread.user_a_id !== user._id && thread.user_b_id !== user._id) {
      throw new Error("Forbidden");
    }

    return await ctx.db
      .query("letters")
      .withIndex("by_thread_id", (q) => q.eq("thread_id", args.threadId))
      .order("asc")
      .collect();
  },
});
