import { describe, it, expect } from 'vitest';
import {
  deriveHealthStatus,
  statusToHttpCode,
  HEALTH_THRESHOLDS,
  type HealthMetrics,
} from './health';

// A fully-healthy baseline; each test overrides only what it exercises.
function metrics(overrides: Partial<HealthMetrics> = {}): HealthMetrics {
  return {
    convexReachable: true,
    providers: [{ provider: 'chutes', total: 1, active: 1, available: 1 }],
    llm: { windowMinutes: 15, calls: 0, failures: 0 },
    ...overrides,
  };
}

describe('deriveHealthStatus', () => {
  it('reports healthy when convex is up, a key is available, and no errors', () => {
    const { status, reasons } = deriveHealthStatus(metrics());
    expect(status).toBe('healthy');
    expect(reasons).toEqual(['ok']);
  });

  it('reports unhealthy and short-circuits when convex is unreachable', () => {
    const { status, reasons } = deriveHealthStatus(
      metrics({
        convexReachable: false,
        // Even with healthy-looking keys, unreachable convex wins.
        providers: [{ provider: 'chutes', total: 1, active: 1, available: 1 }],
      })
    );
    expect(status).toBe('unhealthy');
    expect(reasons).toEqual(['convex_unreachable']);
  });

  it('reports unhealthy when every provider with keys has none available', () => {
    const { status, reasons } = deriveHealthStatus(
      metrics({
        providers: [
          { provider: 'chutes', total: 2, active: 2, available: 0 },
          { provider: 'openrouter', total: 1, active: 0, available: 0 },
        ],
      })
    );
    expect(status).toBe('unhealthy');
    expect(reasons).toContain('all_providers_no_available_key');
  });

  it('reports degraded when some (not all) providers are starved', () => {
    const { status, reasons } = deriveHealthStatus(
      metrics({
        providers: [
          { provider: 'chutes', total: 1, active: 1, available: 1 },
          { provider: 'openrouter', total: 1, active: 1, available: 0 },
        ],
      })
    );
    expect(status).toBe('degraded');
    expect(reasons).toContain('some_providers_no_available_key');
  });

  it('ignores providers that have no keys configured at all', () => {
    // total === 0 must not be counted as "starved".
    const { status } = deriveHealthStatus(
      metrics({
        providers: [
          { provider: 'chutes', total: 1, active: 1, available: 1 },
          { provider: 'unused', total: 0, active: 0, available: 0 },
        ],
      })
    );
    expect(status).toBe('healthy');
  });

  it('reports unhealthy when the LLM error rate is critical (trusted sample)', () => {
    const calls = 10;
    const failures = Math.ceil(calls * HEALTH_THRESHOLDS.UNHEALTHY_ERROR_RATE);
    const { status, reasons } = deriveHealthStatus(
      metrics({ llm: { windowMinutes: 15, calls, failures } })
    );
    expect(status).toBe('unhealthy');
    expect(reasons).toContain('llm_error_rate_critical');
  });

  it('reports degraded when the LLM error rate is elevated but not critical', () => {
    // 30% failures: above DEGRADED (0.2), below UNHEALTHY (0.5).
    const { status, reasons } = deriveHealthStatus(
      metrics({ llm: { windowMinutes: 15, calls: 10, failures: 3 } })
    );
    expect(status).toBe('degraded');
    expect(reasons).toContain('llm_error_rate_elevated');
  });

  it('does not trust the error rate below the minimum sample size', () => {
    // 1 of 1 failed = 100% rate, but only 1 call ⇒ not trusted ⇒ healthy.
    expect(HEALTH_THRESHOLDS.MIN_CALLS_FOR_RATE).toBeGreaterThan(1);
    const { status } = deriveHealthStatus(
      metrics({ llm: { windowMinutes: 15, calls: 1, failures: 1 } })
    );
    expect(status).toBe('healthy');
  });

  it('lets a critical error rate override a merely-degraded key situation', () => {
    const { status, reasons } = deriveHealthStatus(
      metrics({
        providers: [
          { provider: 'chutes', total: 1, active: 1, available: 1 },
          { provider: 'openrouter', total: 1, active: 1, available: 0 }, // would be degraded
        ],
        llm: { windowMinutes: 15, calls: 20, failures: 15 }, // 75% ⇒ critical
      })
    );
    expect(status).toBe('unhealthy');
    expect(reasons).toContain('llm_error_rate_critical');
  });
});

describe('statusToHttpCode', () => {
  it('serves 200 for healthy and degraded (still serving traffic)', () => {
    expect(statusToHttpCode('healthy')).toBe(200);
    expect(statusToHttpCode('degraded')).toBe(200);
  });

  it('serves 503 for unhealthy (cannot serve)', () => {
    expect(statusToHttpCode('unhealthy')).toBe(503);
  });
});
