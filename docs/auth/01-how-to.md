# Auth — how-to

## 1. Configure a build

```bash
# .env.local
EXPO_PUBLIC_AUTH_PROVIDER=betterauth             # or clerk — must match stores.auth_provider
EXPO_PUBLIC_AUTH_BASE_URL=https://<store FO origin> # BetterAuth server (no trailing slash)
EXPO_PUBLIC_DEFAULT_STORE_ID=<store uuid>
# clerk builds only:
# EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
```

On the store's **FO** deployment (betterauth):

```bash
BETTER_AUTH_MOBILE_ORIGINS=khanhstoremobile://   # app.json "scheme" + "://"
```

The provider is chosen when Metro bundles. After changing it: `pnpm start --clear`.

## 2. Run it locally

1. FO web running (e.g. `http://192.168.x.x:3001` — use your LAN IP, not `localhost`, for a phone), with `BETTER_AUTH_MOBILE_ORIGINS=khanhstoremobile://`. In Expo Go the app's origin is `exp://…`, which BetterAuth's Expo plugin trusts in development only.
2. BO API running (`EXPO_PUBLIC_API_BASE_URL`), with the store's `fo_api_url` = the FO origin above (the API fetches `{fo_api_url}/api/auth/jwks`).
3. `EXPO_PUBLIC_AUTH_BASE_URL` = the same FO origin. `pnpm start --clear`.
4. Sign in with a verified FO account (sign up on the web first; unverified emails can't sign in).
5. Open Orders: a 200 means the whole chain works (session → `/api/auth/token` → NestJS `BetterAuthMobileGuard`).

## 3. Verify the token by hand

```bash
# After signing in on the web in a browser, from devtools:
fetch('/api/auth/token').then(r => r.json()).then(console.log)
# Decode the payload: expect "profileId", "sub", "iss" = FO origin, "exp" - "iat" = 900, alg EdDSA.
```

## 4. Switch a store's provider

Change BO `stores.auth_provider` (Platform Owner only), rebuild FO with the matching `AUTH_PROVIDER`, and ship an app build with the matching `EXPO_PUBLIC_AUTH_PROVIDER`. The API picks up the change within 30 s (identity config cache).

## 5. Unit tests

```bash
pnpm test:unit   # node --test libs/**/*.test.ts — the token cache
npx tsc --noEmit
pnpm lint
```

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Sign-in fails with `INVALID_ORIGIN` / 403 | FO doesn't trust the app scheme | Set `BETTER_AUTH_MOBILE_ORIGINS=khanhstoremobile://` on FO |
| Signed in, but every API call 401s | Build provider ≠ `stores.auth_provider`, or the store's `fo_api_url` ≠ the FO the app signed in to (issuer mismatch) | Align them (§ 4); check `fo_api_url` |
| 401 on `fo-mobile/me/*` only | Request without `x-store-id` | Go through `useApiClient` / `fetchChallenge`, which add it |
| "Please verify your email first" | `requireEmailVerification` on FO | Click the link in the email (sign-up is web-only) |
| Asked for a code at sign-in | Admin account with two-factor | Enter the authenticator or a backup code |
| `Scheme not found in app.json` at start | `@better-auth/expo` needs `scheme` | Keep `"scheme": "khanhstoremobile"` in `app.json` |
| Old provider still active after switching | Metro cache | `pnpm start --clear` |
