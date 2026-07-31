// Minimal fixed-window in-memory rate limiter keyed by an arbitrary string
// (we key by client IP). No external deps; the clock is injectable so the
// windowing logic is deterministic under test. Suitable for a single-process
// server — state is per-process and resets on restart, which is fine for
// casual anti-flood on the anonymous suggestions endpoint.

export interface RateLimiterOptions {
  /** Max allowed hits within a window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Clock, injectable for tests. Defaults to Date.now. */
  now?: () => number;
}

interface Window {
  count: number;
  resetAt: number;
}

export interface RateLimiter {
  /** Records a hit for `key`; returns true if it is allowed (under the limit). */
  check(key: string): boolean;
}

export function createRateLimiter(opts: RateLimiterOptions): RateLimiter {
  const { limit, windowMs } = opts;
  const now = opts.now ?? Date.now;
  const windows = new Map<string, Window>();

  return {
    check(key: string): boolean {
      const t = now();
      const existing = windows.get(key);

      if (!existing || t >= existing.resetAt) {
        windows.set(key, { count: 1, resetAt: t + windowMs });
        // Opportunistically evict expired windows so the map doesn't grow
        // unbounded across many distinct IPs.
        if (windows.size > 1000) {
          for (const [k, w] of windows) {
            if (t >= w.resetAt) windows.delete(k);
          }
        }
        return true;
      }

      if (existing.count >= limit) return false;
      existing.count += 1;
      return true;
    },
  };
}
