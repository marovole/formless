import type { UserIdentity } from "convex/server";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

function buildFullName(identity: UserIdentity): string | undefined {
  if (identity.name && identity.name.trim()) return identity.name.trim();

  const parts = [identity.givenName, identity.familyName]
    .map((p) => p?.trim())
    .filter(Boolean) as string[];

  if (parts.length === 0) return undefined;
  return parts.join(" ");
}

export async function ensureCurrentUserFromIdentity(
  ctx: MutationCtx,
  identity: UserIdentity,
  args: {
    preferredLanguage?: string;
    fullName?: string;
    avatarUrl?: string;
  },
): Promise<Id<"users">> {
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
}
