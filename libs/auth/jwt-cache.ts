/**
 * In-memory cache for the short-lived NestJS Bearer JWT (BetterAuth mints it
 * from FO's `GET /api/auth/token`, 15 min expiry). Without it every API call
 * would cost an extra round trip to the FO server first.
 *
 * - Reused until REFRESH_MARGIN_MS before `exp`, then re-minted.
 * - Concurrent callers share one in-flight request (single-flight).
 * - `skipCache` forces a fresh token (the API client does this once on a 401).
 *
 * Dependency-free so `node --test` can run it (libs/auth/jwt-cache.test.ts).
 */

export const REFRESH_MARGIN_MS = 60_000;

/** `exp` (seconds) from a JWT, or 0 when unreadable (treated as expired). */
export function jwtExpSeconds(token: string): number {
  try {
    const part = token.split('.')[1] ?? '';
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp : 0;
  } catch {
    return 0;
  }
}

export type TokenCache = {
  get: (options?: { skipCache?: boolean }) => Promise<string | null>;
  clear: () => void;
};

export function createTokenCache(
  mint: () => Promise<string | null>,
  now: () => number = Date.now,
): TokenCache {
  let cached: { token: string; expMs: number } | null = null;
  let inflight: Promise<string | null> | null = null;
  // Bumped by clear(): a mint that started before a sign-out must not
  // repopulate the cache afterwards.
  let generation = 0;

  return {
    async get(options) {
      if (!options?.skipCache && cached && cached.expMs - now() > REFRESH_MARGIN_MS) {
        return cached.token;
      }
      if (inflight) return inflight;
      const started = generation;
      inflight = mint()
        .then((token) => {
          if (started === generation) {
            cached = token ? { token, expMs: jwtExpSeconds(token) * 1000 } : null;
          }
          return token;
        })
        .finally(() => {
          inflight = null;
        });
      return inflight;
    },
    clear() {
      generation += 1;
      cached = null;
      inflight = null;
    },
  };
}
