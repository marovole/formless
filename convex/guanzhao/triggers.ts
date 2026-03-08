import { MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { TRIGGER_IDS, GUANZHAO_HOUR_RANGES, GUANZHAO_DURATIONS } from "./constants";
import { getZonedDate } from "./utils";

// ============================================================================
// Trigger Evaluation Functions for Guanzhao (Mindfulness) System
// ============================================================================

export async function shouldTriggerDailyCheckinNow(
  ctx: MutationCtx,
  userId: Id<"users">,
  dayKey: string,
): Promise<boolean> {
  const existing = await ctx.db.query("guanzhao_trigger_history")
    .withIndex("by_user_trigger_day", (q) =>
      q
        .eq("user_id", userId)
        .eq("trigger_id", TRIGGER_IDS.DAILY_CHECKIN)
        .eq("day_key", dayKey),
    )
    .filter(q => q.eq(q.field("channel"), "in_app"))
    .first();

  if (existing) return false;

  const sessionsToday = await ctx.db
    .query("user_sessions")
    .withIndex("by_user_day", (q) => q.eq("user_id", userId).eq("day_key", dayKey))
    .take(2);

  return sessionsToday.length === 1;
}

export async function shouldTriggerNightlyWrapupNow(
  ctx: MutationCtx,
  userId: Id<"users">,
  timezone: string,
  dayKey: string,
): Promise<boolean> {
  const zonedNow = getZonedDate(new Date(), timezone);
  const hour = zonedNow.getHours();

  if (hour < GUANZHAO_HOUR_RANGES.NIGHTLY_WRAPUP_START ||
      hour >= GUANZHAO_HOUR_RANGES.NIGHTLY_WRAPUP_END) {
    return false;
  }

  const existing = await ctx.db.query("guanzhao_trigger_history")
    .withIndex("by_user_trigger_day", (q) =>
      q
        .eq("user_id", userId)
        .eq("trigger_id", TRIGGER_IDS.NIGHTLY_WRAPUP)
        .eq("day_key", dayKey),
    )
    .filter(q => q.eq(q.field("channel"), "in_app"))
    .first();

  return !existing;
}

export async function shouldTriggerOverloadProtectionNow(
  ctx: MutationCtx,
  userId: Id<"users">,
  timezone: string,
  session: Doc<'user_sessions'>
): Promise<boolean> {
  const now = new Date();
  const zonedNow = getZonedDate(now, timezone);
  const hour = zonedNow.getHours();

  let shouldTrigger = false;

  // Late night check
  if (hour >= GUANZHAO_HOUR_RANGES.LATE_NIGHT_START &&
      hour < GUANZHAO_HOUR_RANGES.LATE_NIGHT_END) {
    shouldTrigger = true;
  }

  // Long session check
  if (!shouldTrigger) {
    const durationMinutes = (now.getTime() - session._creationTime) / (1000 * 60);
    if (durationMinutes >= GUANZHAO_DURATIONS.SESSION_OVERLOAD_MINUTES) {
      shouldTrigger = true;
    }
  }

  if (!shouldTrigger) return false;

  // Check cooldown
  const recent = await ctx.db.query("guanzhao_trigger_history")
    .withIndex("by_user_trigger", q =>
      q.eq("user_id", userId).eq("trigger_id", TRIGGER_IDS.OVERLOAD_PROTECTION))
    .filter(q => q.eq(q.field("channel"), "in_app"))
    .order("desc")
    .first();

  if (recent) {
    const minutesAgo = (now.getTime() - recent._creationTime) / (1000 * 60);
    if (minutesAgo < GUANZHAO_DURATIONS.SESSION_COOLDOWN_MINUTES) {
      return false;
    }
  }

  return true;
}