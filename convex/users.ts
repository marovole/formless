import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireIdentity } from "./_lib/auth";

function buildFullName(identity: {
  name?: string;
  givenName?: string;
  familyName?: string;
}): string | undefined {
  if (identity.name && identity.name.trim()) return identity.name.trim();

  const parts = [identity.givenName, identity.familyName]
    .map((p) => p?.trim())
    .filter(Boolean) as string[];

  if (parts.length === 0) return undefined;
  return parts.join(" ");
}

export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
  },
});

export const ensureCurrent = mutation({
  args: {
    preferredLanguage: v.optional(v.string()),
    fullName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);

    const email = identity.email;
    if (!email) {
      throw new Error("Missing email claim in auth token.");
    }

    const fullName = args.fullName?.trim() || buildFullName(identity);
    const avatarUrl = args.avatarUrl?.trim() || identity.pictureUrl;

    const existingByClerkId = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (existingByClerkId) {
      await ctx.db.patch(existingByClerkId._id, {
        email,
        tokenIdentifier: identity.tokenIdentifier,
        full_name: fullName,
        avatar_url: avatarUrl,
        preferred_language: args.preferredLanguage,
        updated_at: Date.now(),
      });

      return existingByClerkId._id;
    }

    const existingByEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existingByEmail) {
      await ctx.db.patch(existingByEmail._id, {
        clerkId: identity.subject,
        tokenIdentifier: identity.tokenIdentifier,
        full_name: fullName ?? existingByEmail.full_name,
        avatar_url: avatarUrl ?? existingByEmail.avatar_url,
        preferred_language: args.preferredLanguage ?? existingByEmail.preferred_language,
        updated_at: Date.now(),
      });
      return existingByEmail._id;
    }

    return await ctx.db.insert("users", {
      email,
      clerkId: identity.subject,
      tokenIdentifier: identity.tokenIdentifier,
      full_name: fullName,
      avatar_url: avatarUrl,
      preferred_language: args.preferredLanguage,
      updated_at: Date.now(),
    });
  },
});

