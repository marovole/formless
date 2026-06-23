import { internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./_lib/auth";

// ──────────────────────────────────────────────────────────────────────────
// Observability reads. Errors are ALREADY captured by api_usage (success=false
// + error_message, written in app/api/chat/streaming.ts onError) and by the
// structured logger. This module only *surfaces* that existing data — it does
// not add a parallel error sink. Status derivation lives in
// lib/monitoring/health.ts so it stays unit-tested and single-sourced.
// ──────────────────────────────────────────────────────────────────────────

const HEALTH_WINDOW_MS = 15 * 60 * 1000; // rolling window for LLM error rate
const HEALTH_SCAN_LIMIT = 500; // hard cap so a busy minute can't blow up the probe
const RECENT_ERRORS_DEFAULT = 50;
const RECENT_ERRORS_MAX = 200;
const DEFAULT_DAILY_LIMIT = 1000; // mirrors api_keys API_KEY_DEFAULTS.DAILY_LIMIT

/**
 * Public liveness probe. No auth, no data exposure — only proves the Convex
 * deployment is reachable and serving queries. Used by /api/health as a
 * fallback when the admin-scoped health read is unavailable.
 */
export const ping = query({
  args: {},
  handler: async () => ({ ok: true as const, now: Date.now() }),
});

/**
 * Internal health snapshot: raw counters only (status is derived app-side).
 * Bounded reads: api_keys is tiny; api_usage is capped at HEALTH_SCAN_LIMIT
 * rows within the recent window via the by_created_at index.
 */
export const getHealthInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const since = now - HEALTH_WINDOW_MS;

    // Key availability per provider (mirrors peekAvailableInternal's lazy reset).
    const keys = await ctx.db.query("api_keys").collect();
    const byProvider = new Map<
      string,
      { total: number; active: number; available: number }
    >();
    for (const k of keys) {
      const p = byProvider.get(k.provider) ?? { total: 0, active: 0, available: 0 };
      p.total += 1;
      if (k.is_active ?? true) {
        p.active += 1;
        const limit = k.daily_limit ?? DEFAULT_DAILY_LIMIT;
        const resetAt = k.reset_at ?? 0;
        const used = resetAt < now ? 0 : k.daily_used ?? 0; // daily limit resets lazily
        if (used < limit) p.available += 1;
      }
      byProvider.set(k.provider, p);
    }
    const providers = Array.from(byProvider.entries()).map(([provider, s]) => ({
      provider,
      total: s.total,
      active: s.active,
      available: s.available,
    }));

    // Recent LLM outcomes — newest first, bounded scan over the time window.
    const recent = await ctx.db
      .query("api_usage")
      .withIndex("by_created_at", (q) => q.gt("created_at", since))
      .order("desc")
      .take(HEALTH_SCAN_LIMIT);
    const calls = recent.length;
    const failures = recent.filter((u) => u.success === false).length;

    return {
      convexReachable: true,
      providers,
      llm: {
        windowMinutes: HEALTH_WINDOW_MS / 60_000,
        calls,
        failures,
      },
    };
  },
});

/**
 * Admin-only: the most recent failed LLM calls so an operator can *locate* an
 * error (message + provider + model + when) without trawling Convex logs.
 * The scan is bounded to a multiple of the requested limit so a healthy stream
 * of successes can never force an unbounded read.
 */
export const recentErrors = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = Math.min(args.limit ?? RECENT_ERRORS_DEFAULT, RECENT_ERRORS_MAX);

    const scan = await ctx.db
      .query("api_usage")
      .withIndex("by_created_at")
      .order("desc")
      .take(limit * 10);

    return scan
      .filter((u) => u.success === false)
      .slice(0, limit)
      .map((u) => ({
        id: u._id,
        provider: u.provider,
        model_name: u.model_name ?? null,
        error_message: u.error_message ?? null,
        response_time_ms: u.response_time_ms ?? null,
        created_at: u.created_at ?? u._creationTime,
      }));
  },
});
