import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { TRIGGER_IDS } from "./constants";
import { SessionEventResponse, UserSessionUpdate } from "./types";
import { getCurrentLocalKeys } from "./utils";
import { shouldTriggerDailyCheckinNow, shouldTriggerNightlyWrapupNow, shouldTriggerOverloadProtectionNow } from "./triggers";

// ============================================================================
// Session Event Handlers for Guanzhao (Mindfulness) System
// ============================================================================

export async function handleSessionStart(
  ctx: MutationCtx,
  userId: Id<'users'>,
  timezone: string
): Promise<SessionEventResponse> {
  const dayKey = getCurrentLocalKeys(timezone).dayKey;

  const sessionId = await ctx.db.insert("user_sessions", {
    user_id: userId,
    timezone,
    day_key: dayKey,
    week_key: getCurrentLocalKeys(timezone).weekKey,
    last_activity_at: Date.now()
  });

  const shouldTrigger = await shouldTriggerDailyCheckinNow(ctx, userId, dayKey);

  return {
    success: true,
    sessionId,
    shouldTrigger: shouldTrigger ? {
      triggerId: TRIGGER_IDS.DAILY_CHECKIN,
      reason: 'First session of the day'
    } : undefined
  };
}

export async function handleSessionEnd(
  ctx: MutationCtx,
  userId: Id<'users'>,
  sessionId: Id<'user_sessions'>
): Promise<SessionEventResponse> {
  await ctx.db.patch(sessionId, { ended_at: Date.now() });

  const session = await ctx.db.get(sessionId);
  if (!session) throw new Error("Session not found");

  const timezone = session.timezone || "UTC";
  const dayKey = getCurrentLocalKeys(timezone).dayKey;

  const shouldTrigger = await shouldTriggerNightlyWrapupNow(
    ctx,
    userId,
    timezone,
    dayKey,
  );
  return {
    success: true,
    shouldTrigger: shouldTrigger ? {
      triggerId: TRIGGER_IDS.NIGHTLY_WRAPUP,
      reason: 'Session ended in evening hours'
    } : undefined
  };
}

export async function handleInSession(
  ctx: MutationCtx,
  userId: Id<'users'>,
  sessionId: Id<'user_sessions'>,
  messagesCount?: number
): Promise<SessionEventResponse> {
  const updates: UserSessionUpdate = { last_activity_at: Date.now() };
  if (messagesCount !== undefined) updates.messages_count = messagesCount;

  await ctx.db.patch(sessionId, updates);

  const session = await ctx.db.get(sessionId);
  if (!session) throw new Error("Session not found");

  const shouldTrigger = await shouldTriggerOverloadProtectionNow(
    ctx,
    userId,
    session.timezone || "UTC",
    session,
  );
  return {
    success: true,
    shouldTrigger: shouldTrigger ? {
      triggerId: TRIGGER_IDS.OVERLOAD_PROTECTION,
      reason: 'Long session detected or late hour'
    } : undefined
  };
}