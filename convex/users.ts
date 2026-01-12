import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const ensure = mutation({
  args: {
    email: v.string(),
    clerkId: v.string(),
    fullName: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (user) return user._id;

    const userByEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (userByEmail) {
        await ctx.db.patch(userByEmail._id, {
          clerkId: args.clerkId,
          full_name: args.fullName ?? userByEmail.full_name
        });
        return userByEmail._id;
    }

    return await ctx.db.insert("users", {
      email: args.email,
      clerkId: args.clerkId,
      full_name: args.fullName,
      updated_at: Date.now(),
    });
  },
});

export const get = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
