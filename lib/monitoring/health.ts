/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║  Health derivation — pure, deployment-agnostic                       ║
 * ║                                                                      ║
 * ║  Convex (convex/monitoring.getHealthInternal) emits raw counters;    ║
 * ║  this module turns them into a single coarse status. It deliberately ║
 * ║  imports nothing from Convex or Next so it stays unit-testable and   ║
 * ║  remains the ONE place alert thresholds live.                        ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/** Per-provider key availability, derived from the api_keys table. */
export interface ProviderKeyStats {
  provider: string;
  total: number; // configured keys
  active: number; // is_active === true
  available: number; // active AND under daily limit (after lazy reset)
}

/** LLM call outcomes over a recent rolling window, from api_usage. */
export interface LlmWindowStats {
  windowMinutes: number;
  calls: number;
  failures: number;
}

/** Raw metrics emitted by convex/monitoring.getHealthInternal. */
export interface HealthMetrics {
  convexReachable: boolean;
  providers: ProviderKeyStats[];
  llm: LlmWindowStats;
}

export interface HealthResult {
  status: HealthStatus;
  reasons: string[];
}

// Thresholds — tuned for a small single-tenant deployment.
// Change them here and every caller (route + tests) follows.
export const HEALTH_THRESHOLDS = {
  /** Min calls in the window before an error rate is trusted (avoid 1/1 = 100%). */
  MIN_CALLS_FOR_RATE: 5,
  /** Error rate at/above which the service is degraded. */
  DEGRADED_ERROR_RATE: 0.2,
  /** Error rate at/above which the service is unhealthy. */
  UNHEALTHY_ERROR_RATE: 0.5,
} as const;

/**
 * Collapse raw metrics into one status. Severity is monotonic: an unhealthy
 * signal can never be downgraded by a milder one, so the order of checks below
 * is deliberate (hard-down first, then critical, then degraded).
 */
export function deriveHealthStatus(m: HealthMetrics): HealthResult {
  // Convex unreachable ⇒ hard down; nothing else can be trusted.
  if (!m.convexReachable) {
    return { status: 'unhealthy', reasons: ['convex_unreachable'] };
  }

  const reasons: string[] = [];

  // Key availability. A provider with keys configured but none available means
  // that provider's traffic will fail.
  const providersWithKeys = m.providers.filter((p) => p.total > 0);
  const starved = providersWithKeys.filter((p) => p.available === 0);
  const allStarved =
    providersWithKeys.length > 0 && starved.length === providersWithKeys.length;

  // LLM error rate over the window, only trusted past a minimum sample size.
  const { calls, failures } = m.llm;
  const errorRate = calls > 0 ? failures / calls : 0;
  const rateTrusted = calls >= HEALTH_THRESHOLDS.MIN_CALLS_FOR_RATE;

  let status: HealthStatus = 'healthy';

  // --- Unhealthy (cannot serve) ---
  if (allStarved) {
    status = 'unhealthy';
    reasons.push('all_providers_no_available_key');
  }
  if (rateTrusted && errorRate >= HEALTH_THRESHOLDS.UNHEALTHY_ERROR_RATE) {
    status = 'unhealthy';
    reasons.push('llm_error_rate_critical');
  }

  // --- Degraded (still serves, but something is wrong) ---
  // Only downgrade from healthy; never override an unhealthy verdict.
  if (status === 'healthy' && starved.length > 0) {
    status = 'degraded';
    reasons.push('some_providers_no_available_key');
  }
  if (
    status === 'healthy' &&
    rateTrusted &&
    errorRate >= HEALTH_THRESHOLDS.DEGRADED_ERROR_RATE
  ) {
    status = 'degraded';
    reasons.push('llm_error_rate_elevated');
  }

  if (reasons.length === 0) reasons.push('ok');
  return { status, reasons };
}

/**
 * Liveness contract for external uptime monitors:
 *   degraded still serves traffic (200), unhealthy cannot (503).
 */
export function statusToHttpCode(status: HealthStatus): number {
  return status === 'unhealthy' ? 503 : 200;
}
