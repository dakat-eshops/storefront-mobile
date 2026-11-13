// Run: pnpm test:unit (node --test, no RN runtime needed).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTokenCache, jwtExpSeconds, REFRESH_MARGIN_MS } from './jwt-cache.ts';

const jwt = (exp: number) =>
  `h.${Buffer.from(JSON.stringify({ exp, profileId: 'p' })).toString('base64url')}.s`;

test('reads exp from a base64url payload; unreadable → 0', () => {
  assert.equal(jwtExpSeconds(jwt(1_800_000_000)), 1_800_000_000);
  assert.equal(jwtExpSeconds('not-a-jwt'), 0);
});

test('reuses a token until the refresh margin, then re-mints', async () => {
  let t = 1_000_000_000_000;
  let mints = 0;
  const cache = createTokenCache(async () => {
    mints += 1;
    return jwt(Math.floor(t / 1000) + 15 * 60);
  }, () => t);
  await cache.get();
  await cache.get();
  assert.equal(mints, 1);
  t += 15 * 60 * 1000 - REFRESH_MARGIN_MS + 1;
  await cache.get();
  assert.equal(mints, 2);
});

test('single-flights concurrent callers', async () => {
  let mints = 0;
  const cache = createTokenCache(async () => {
    mints += 1;
    return jwt(Math.floor(Date.now() / 1000) + 900);
  });
  await Promise.all([cache.get(), cache.get(), cache.get()]);
  assert.equal(mints, 1);
});

test('skipCache forces a fresh token', async () => {
  let mints = 0;
  const cache = createTokenCache(async () => {
    mints += 1;
    return jwt(Math.floor(Date.now() / 1000) + 900);
  });
  await cache.get();
  await cache.get({ skipCache: true });
  assert.equal(mints, 2);
});

test('a mint that started before clear() does not repopulate the cache', async () => {
  let release!: (v: string) => void;
  let mints = 0;
  const cache = createTokenCache(() => {
    mints += 1;
    return new Promise<string>((resolve) => {
      release = resolve;
    });
  });
  const pending = cache.get();
  cache.clear(); // signed out meanwhile
  release(jwt(Math.floor(Date.now() / 1000) + 900));
  await pending;
  const next = cache.get();
  release(jwt(Math.floor(Date.now() / 1000) + 900));
  await next;
  assert.equal(mints, 2);
});

test('a null token (signed out) is not cached', async () => {
  let mints = 0;
  const cache = createTokenCache(async () => {
    mints += 1;
    return null;
  });
  assert.equal(await cache.get(), null);
  await cache.get();
  assert.equal(mints, 2);
});
