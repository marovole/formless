import { CHAT_RATE_LIMIT } from '@/lib/constants';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Simple in-process rate limiter for Edge (best-effort per isolate).
 * Returns an HTTP 429 message if over limit.
 */
export function checkChatRateLimit(clerkUserId: string):
  | { ok: true }
  | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  let b = buckets.get(clerkUserId);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + CHAT_RATE_LIMIT.WINDOW_MS };
    buckets.set(clerkUserId, b);
  }
  b.count += 1;
  if (b.count > CHAT_RATE_LIMIT.LIMIT) {
    return { ok: false, retryAfterMs: Math.max(0, b.resetAt - now) };
  }
  return { ok: true };
}
