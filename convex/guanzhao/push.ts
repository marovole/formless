import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { upsertBudgetTracking } from "./budget";

// ============================================================================
// Push Notification Token Management for Guanzhao (Mindfulness) System
// ============================================================================

export const registerPushToken = async (
  ctx: MutationCtx,
  userId: Id<'users'>,
  token: string,
  platform: string,
  deviceId?: string
) => {
  const existing = await ctx.db.query("push_tokens")
    .withIndex("by_token", q => q.eq("token", token))
    .filter(q => q.eq(q.field("user_id"), userId))
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, {
      last_used_at: Date.now(),
      is_active: true,
      updated_at: Date.now(),
    });
  } else {
    await ctx.db.insert("push_tokens", {
      user_id: userId,
      token,
      platform,
      device_id: deviceId,
      is_active: true,
      last_used_at: Date.now(),
      updated_at: Date.now(),
    });
  }

  // Also enable push notification settings
  await upsertBudgetTracking(ctx, userId, { push_enabled: true, enabled: true });

  return { success: true };
};

export const deactivatePushToken = async (
  ctx: MutationCtx,
  userId: Id<'users'>,
  token: string
) => {
  const tokenRecord = await ctx.db.query("push_tokens")
    .withIndex("by_token", q => q.eq("token", token))
    .filter(q => q.eq(q.field("user_id"), userId))
    .first();

  if (tokenRecord) {
    await ctx.db.patch(tokenRecord._id, { is_active: false, updated_at: Date.now() });
  }

  return { success: true };
};

export const getPushTokens = async (
  ctx: QueryCtx,
  userId: Id<'users'>
) => {
  return await ctx.db
    .query("push_tokens")
    .withIndex("by_user_id", (q) => q.eq("user_id", userId))
    .filter(q => q.eq(q.field("is_active"), true))
    .order("desc")
    .collect();
};