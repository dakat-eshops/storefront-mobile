# Auth — BetterAuth (default) or Clerk

The app signs customers in with **the same identity provider as its store's web FO**, chosen at bundle time:

| `EXPO_PUBLIC_AUTH_PROVIDER` | Session | NestJS Bearer token | Must match |
| --- | --- | --- | --- |
| `betterauth` (default) | BetterAuth cookie in SecureStore, via `@better-auth/expo` against the store's FO (`{EXPO_PUBLIC_AUTH_BASE_URL}/api/auth`) | EdDSA JWT minted from FO `GET /api/auth/token` (15 min, carries `profileId`), cached in memory | `stores.auth_provider = 'betterauth'` (BO), FO built with `AUTH_PROVIDER=betterauth` |
| `clerk` (Platform-Owner exception) | Clerk Expo SDK, token cache in SecureStore | Clerk session token | `stores.auth_provider = 'clerk'` |

NestJS (`/2026-01/fo-mobile/*`) verifies whichever arrives through `IdentityMobileGuard`, which reads the store's `auth_provider` and dispatches to `BetterAuthMobileGuard` or `ClerkMobileGuard` (BO `docs/platform/fo-api/02-auth-and-security.md` § Mode 3). **A build whose provider doesn't match its store gets 401 on every signed-in request.**

**Status (2026-11-12): ✅ code-complete, bundles in both modes. ⚠️ Not yet run on a device** against a live FO + API. See [Implementation status](#implementation-status).

## Contents

- [01-how-to.md](01-how-to.md): configure a build, run it locally against FO + API, verify the token, switch provider, troubleshooting.

## How it fits together

```text
screens / hooks ──▶ @/libs/auth/provider ──(Metro alias)──▶ provider.betterauth.tsx | provider.clerk.tsx
                     useAuth()  { isLoaded, isSignedIn, userId, displayName, getToken, signOut }
                     useSignIn() { signInWithPassword, submitCode }
                     AuthRoot    (ClerkProvider + ClerkLoaded | passthrough)

useApiClient ──getToken()──▶ betterauth: jwt-cache ──miss──▶ FO GET /api/auth/token (session cookie)
             ──Bearer + x-store-id + x-device-attestation──▶ NestJS fo-mobile ──▶ IdentityMobileGuard
```

- **One provider per bundle.** `metro.config.js` resolves `@/libs/auth/provider` to the chosen file, so a BetterAuth build contains no Clerk SDK and vice versa (checked: the iOS bundle of each mode has zero strings from the other). `libs/auth/provider.ts` only exists for `tsc`, which checks against the BetterAuth default. Same idea as the web FO's `next.config.ts` aliases.
- **Nothing outside `libs/auth/` imports `@clerk/expo` or the BetterAuth client.** Screens use `useAuth()` / `useSignIn()`.
- **Token cache** (`libs/auth/jwt-cache.ts`): reused until 60 s before `exp`, concurrent callers share one mint, cleared on sign-out or user change, and a mint that started before a sign-out can't repopulate it. Without it every API call would first cost a round trip to FO.
- **401 retry**: `useApiClient` re-mints once (`getToken({ skipCache: true })`) on a 401 and retries, covering a token revoked before its `exp`.
- **`x-store-id`** goes on every request: `fo-mobile/me/*` has no `:storeId` in its path, and the guard needs the store to pick the provider.
- **Offline**: `@better-auth/expo` caches the last session in SecureStore, so an offline launch still knows who is signed in. Minting a NestJS token needs the network, like any API call.
- **Admins with two-factor** (FO [admin-mfa](../../../KhanhStore/docs/auth/authentication/admin-mfa/README.md)): email sign-in returns `needs-code`; the screen asks for the authenticator or a backup code. Shoppers never see it.

## Server side this depends on

| Repo | What | Where |
| --- | --- | --- |
| FO web | `expo()` BetterAuth plugin + the app scheme in `BETTER_AUTH_MOBILE_ORIGINS` (`khanhstoremobile://`) | FO `docs/auth/authentication/10-mobile-betterauth.md` |
| FO web | JWT carries `profileId`, EdDSA (fixed 2026-11-12: it carried no `profileId` before) | FO `05-betterauth-configuration.md` § `jwt` |
| BO API | Every `fo-mobile` controller on `IdentityMobileGuard` (was `ClerkMobileGuard` only until 2026-11-12); store identity config cached 30 s | BO `docs/platform/data-residency/04-implementation-plan.md` |

## Not in the app yet

Same scope as the Clerk screen it replaces: **sign-in only**. Sign-up, password reset, Google / Facebook / Zalo sign-in and email verification happen on the web FO. `@better-auth/expo` supports social sign-in through the system browser (`expo-authorization-proxy` is already served by FO), so adding it later is a client change.

## Implementation status

| Status | Item | Files |
| --- | --- | --- |
| ✅ 2026-11-12 | Provider-agnostic auth surface + Metro bundle-time alias | `libs/auth/{types,provider,provider.betterauth,provider.clerk}.ts(x)`, `metro.config.js` |
| ✅ 2026-11-12 | BetterAuth client (SecureStore session, two-factor), NestJS token mint + cache | `libs/auth/better-auth-client.ts`, `libs/auth/jwt-cache.ts` |
| ✅ 2026-11-12 | All call sites moved off `@clerk/expo` | `app/_layout.tsx`, `app/sign-in.tsx`, `app/(tabs)/account.tsx`, `app/orders.tsx`, `features/cart/components/cart-sync-provider.tsx`, `features/orders/hooks/use-orders.ts`, `libs/{api-client,device-attestation,push-notifications}.ts`, `libs/realtime/realtime-provider.tsx` |
| ✅ 2026-11-12 | API client: 401 re-mint + retry, `x-store-id` | `libs/api-client.ts` |
| ✅ 2026-11-12 | Env + config | `libs/env.ts`, `app.config.ts`, `.env.example` |
| ✅ 2026-11-12 | Tests: token cache (6, `pnpm test:unit`); both modes bundle (`expo export`, iOS) | `libs/auth/jwt-cache.test.ts` |

- [~] Device run (simulator or phone) against a local FO + API: sign in, browse, cart sync, orders, push registration, sign out. See [01-how-to.md § 2](01-how-to.md#2-run-it-locally).
- [ ] Sign-up / password reset / social sign-in in the app (web-only today).
- [ ] A component/hook test runner for RN (none wired in this repo; `node --test` covers the pure token cache only).

### Rollout coupling

For a store on `betterauth`, an **old app build (Clerk) gets 401** on signed-in requests once the BO API change is deployed. Ship the BetterAuth app build for that store with or before the API change, and make sure its FO has `BETTER_AUTH_MOBILE_ORIGINS` set and the [admin-mfa schema push](../../../KhanhStore/docs/auth/authentication/admin-mfa/02-how-to.md#1-roll-out) done.
