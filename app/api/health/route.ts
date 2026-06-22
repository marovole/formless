import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getConvexClient, getConvexAdminClient } from '@/lib/convex';
import { api, internal } from '@/convex/_generated/api';
import { logger } from '@/lib/logger';
import {
  deriveHealthStatus,
  statusToHttpCode,
  type HealthMetrics,
} from '@/lib/monitoring/health';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const healthLogger = logger.child('health');

async function isAdminRequest(): Promise<boolean> {
  try {
    const { userId } = await auth();
    if (!userId) return false;
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
    return !!email && ADMIN_EMAILS.includes(email);
  } catch {
    return false;
  }
}

/**
 * GET /api/health — liveness + coarse health for external uptime monitors.
 *
 * Public body: { status, timestamp }, status ∈ healthy | degraded | unhealthy.
 *   200 for healthy/degraded (service still serves), 503 for unhealthy.
 *   Point an uptime monitor (UptimeRobot / Cloudflare Health Checks) at this URL
 *   and alert on non-200 OR body.status !== "healthy" — that is the alert path
 *   for convex-down / all-keys-exhausted / LLM-error-spike. See docs/OPERATIONS.md.
 *
 * ?detail=1 with an admin session additionally returns raw metrics
 *   (per-provider key availability, recent LLM error counts) to locate issues.
 *   Non-admins get the plain public body regardless of the flag (no leak).
 */
export async function GET(request: NextRequest) {
  const wantDetail = request.nextUrl.searchParams.get('detail') === '1';

  // Primary path: admin-scoped read computes the full snapshot.
  // Fallback path: if that fails, a public ping tells convex-down (unhealthy)
  // apart from a mere admin-token misconfig (degraded — service still serves).
  let metrics: HealthMetrics;
  let detailUnavailable = false;
  try {
    metrics = await getConvexAdminClient().query<HealthMetrics>(
      internal.monitoring.getHealthInternal
    );
  } catch (adminError) {
    detailUnavailable = true;
    healthLogger.error('admin health read failed; falling back to liveness ping', {
      error: String(adminError),
    });
    let convexReachable = false;
    try {
      await getConvexClient().query(api.monitoring.ping);
      convexReachable = true;
    } catch {
      convexReachable = false;
    }
    metrics = {
      convexReachable,
      providers: [],
      llm: { windowMinutes: 15, calls: 0, failures: 0 },
    };
  }

  let { status, reasons } = deriveHealthStatus(metrics);

  // Convex is up but we couldn't read the detail — surface the misconfig as
  // degraded instead of a false "healthy" or a false full outage.
  if (detailUnavailable && metrics.convexReachable && status === 'healthy') {
    status = 'degraded';
    reasons = ['health_detail_unavailable'];
  }

  const body: Record<string, unknown> = {
    status,
    timestamp: new Date().toISOString(),
  };

  if (wantDetail && (await isAdminRequest())) {
    body.reasons = reasons;
    body.metrics = metrics;
  }

  return NextResponse.json(body, {
    status: statusToHttpCode(status),
    headers: { 'Cache-Control': 'no-store' },
  });
}
