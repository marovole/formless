import { MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import guanzhaoBundle from "../../docs/guanzhao/guanzhao-bundle.json";
import type { GuanzhaoConfig } from "./types";
import { getCurrentLocalKeys } from "./utils";

// ============================================================================
// Budget and Settings Management for Guanzhao (Mindfulness) System
// ============================================================================

export async function upsertBudgetTracking(
  ctx: MutationCtx,
  userId: Id<'users'>,
  updates: Record<string, unknown>
): Promise<void> {
  const timezoneHint =
    typeof updates.timezone === "string" ? (updates.timezone as string) : undefined;

  const settings = await ensureUserSettings(ctx, userId, timezoneHint);
  await ctx.db.patch(settings._id, { ...updates, updated_at: Date.now() });
}

export async function initializeUserSettings(
  ctx: MutationCtx,
  userId: Id<"users">,
  timezoneHint?: string,
) {
  const defaults = (guanzhaoBundle as GuanzhaoConfig).defaults;
  const frequencyLevel = defaults.frequency_level;
  const budgets = getBudgetsForFrequencyLevel(frequencyLevel);
  const timezone = timezoneHint || "UTC";

  const id = await ctx.db.insert("guanzhao_budget_tracking", {
    user_id: userId,
    timezone,
    day_key: getCurrentLocalKeys(timezone).dayKey,
    week_key: getCurrentLocalKeys(timezone).weekKey,
    enabled: defaults.enabled,
    frequency_level: frequencyLevel,
    push_enabled: defaults.channels.push,
    dnd_start: defaults.dnd_local_time.start,
    dnd_end: defaults.dnd_local_time.end,
    style: defaults.style,
    budget_in_app_day: budgets.in_app_day,
    budget_in_app_week: budgets.in_app_week,
    budget_push_day: budgets.push_day,
    budget_push_week: budgets.push_week,
    used_in_app_day: 0,
    used_in_app_week: 0,
    used_push_day: 0,
    used_push_week: 0,
    updated_at: Date.now(),
  });

  const created = await ctx.db.get(id);
  if (!created) {
    throw new Error("Failed to initialize Guanzhao settings");
  }
  return created;
}

export async function ensureUserSettings(
  ctx: MutationCtx,
  userId: Id<"users">,
  timezoneHint?: string,
): Promise<Doc<"guanzhao_budget_tracking">> {
  let settings = await ctx.db
    .query("guanzhao_budget_tracking")
    .withIndex("by_user_id", (q) => q.eq("user_id", userId))
    .first();

  if (!settings) {
    return await initializeUserSettings(ctx, userId, timezoneHint);
  }

  const config = guanzhaoBundle as GuanzhaoConfig;
  const defaults = config.defaults;

  const nextTimezone = timezoneHint || settings.timezone || "UTC";
  const nextFrequencyLevel = settings.frequency_level || defaults.frequency_level;
  const budgets = getBudgetsForFrequencyLevel(nextFrequencyLevel);
  const keys = getCurrentLocalKeys(nextTimezone);

  const patch: Record<string, unknown> = {};

  if (!settings.timezone) patch.timezone = nextTimezone;
  if (timezoneHint && timezoneHint !== settings.timezone) patch.timezone = timezoneHint;

  if (!settings.day_key) patch.day_key = keys.dayKey;
  if (!settings.week_key) patch.week_key = keys.weekKey;
  if (patch.timezone) {
    patch.day_key = keys.dayKey;
    patch.week_key = keys.weekKey;
  }

  if (settings.enabled === undefined) patch.enabled = defaults.enabled;
  if (!settings.frequency_level) patch.frequency_level = defaults.frequency_level;
  if (settings.push_enabled === undefined) patch.push_enabled = defaults.channels.push;
  if (!settings.dnd_start) patch.dnd_start = defaults.dnd_local_time.start;
  if (!settings.dnd_end) patch.dnd_end = defaults.dnd_local_time.end;
  if (!settings.style) patch.style = defaults.style;

  if (settings.budget_in_app_day === undefined) patch.budget_in_app_day = budgets.in_app_day;
  if (settings.budget_in_app_week === undefined) patch.budget_in_app_week = budgets.in_app_week;
  if (settings.budget_push_day === undefined) patch.budget_push_day = budgets.push_day;
  if (settings.budget_push_week === undefined) patch.budget_push_week = budgets.push_week;

  if (settings.used_in_app_day === undefined) patch.used_in_app_day = 0;
  if (settings.used_in_app_week === undefined) patch.used_in_app_week = 0;
  if (settings.used_push_day === undefined) patch.used_push_day = 0;
  if (settings.used_push_week === undefined) patch.used_push_week = 0;

  if (Object.keys(patch).length > 0) {
    patch.updated_at = Date.now();
    await ctx.db.patch(settings._id, patch);
    settings = { ...settings, ...patch } as Doc<"guanzhao_budget_tracking">;
  }

  return settings;
}

export async function maybeResetBudgetUsage(
  ctx: MutationCtx,
  settings: Doc<"guanzhao_budget_tracking">,
): Promise<Doc<"guanzhao_budget_tracking">> {
  const timezone = settings.timezone || "UTC";
  const keys = getCurrentLocalKeys(timezone);

  const patch: Record<string, unknown> = {};

  if (settings.day_key !== keys.dayKey) {
    patch.day_key = keys.dayKey;
    patch.used_in_app_day = 0;
    patch.used_push_day = 0;
  }

  if (settings.week_key !== keys.weekKey) {
    patch.week_key = keys.weekKey;
    patch.used_in_app_week = 0;
    patch.used_push_week = 0;
  }

  if (Object.keys(patch).length > 0) {
    patch.updated_at = Date.now();
    await ctx.db.patch(settings._id, patch);
    return { ...settings, ...patch } as Doc<"guanzhao_budget_tracking">;
  }

  return settings;
}

export function normalizeSettingsUpdate(
  existing: Doc<"guanzhao_budget_tracking"> | null,
  updates: {
    enabled?: boolean;
    frequency_level?: string;
    push_enabled?: boolean;
    dnd_start?: string;
    dnd_end?: string;
    style?: string;
    snoozed_until?: string;
  }
) {
  const config = guanzhaoBundle as GuanzhaoConfig;
  const nextFrequency =
    updates.frequency_level ?? existing?.frequency_level ?? config.defaults.frequency_level;
  const budgets = getBudgetsForFrequencyLevel(nextFrequency);

  const normalized: Record<string, unknown> = {
    ...updates,
  };

  if (updates.frequency_level) {
    normalized.budget_in_app_day = budgets.in_app_day;
    normalized.budget_in_app_week = budgets.in_app_week;
    normalized.budget_push_day = budgets.push_day;
    normalized.budget_push_week = budgets.push_week;

    normalized.used_in_app_day = 0;
    normalized.used_in_app_week = 0;
    normalized.used_push_day = 0;
    normalized.used_push_week = 0;

    const timezone = existing?.timezone || "UTC";
    normalized.day_key = getCurrentLocalKeys(timezone).dayKey;
    normalized.week_key = getCurrentLocalKeys(timezone).weekKey;
  }

  return normalized;
}

// Helper function needed by budget.ts but defined in utils.ts
function getBudgetsForFrequencyLevel(level: string) {
  const config = guanzhaoBundle as GuanzhaoConfig;
  const frequency =
    config.frequency_levels[level as keyof typeof config.frequency_levels];
  if (!frequency) {
    return { in_app_day: 0, in_app_week: 0, push_day: 0, push_week: 0 };
  }

  return {
    in_app_day: frequency.budgets.in_app.per_day,
    in_app_week: frequency.budgets.in_app.per_week,
    push_day: frequency.budgets.push.per_day,
    push_week: frequency.budgets.push.per_week,
  };
}