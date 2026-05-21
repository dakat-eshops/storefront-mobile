# FO React Native — Initial Integration Design

FO storefront on iOS + Android. Sibling to the Next.js FO web app — same NestJS backend, same Clerk identity, same `@eshops/db` types. **FO ships before BO mobile.**

> **Scope of this folder.** These docs capture the **initial** design — the foundation that took the app to Vertical-1 (browse + cart). Subsequent phases (checkout, orders, cancel/return, wishlist, push, Broadcast subscribers, App Attest / Play Integrity hardening) are handled and documented manually as each is picked up, in sibling folders under [`../`](../README.md). Treat the files here as historical design intent — not a live spec for in-progress work.

## Read order

1. [01-architecture.md](01-architecture.md) — repo placement, shared backend, what RN does and does not share with the web FO
2. [02-setup.md](02-setup.md) — Expo + monorepo wiring, env vars, project layout
3. [03-authentication.md](03-authentication.md) — Clerk on Expo (sign-in, session, guest)
4. [04-api-client.md](04-api-client.md) — **The HMAC problem and the mobile-gateway pattern** (read this before writing any networking code)
5. [05-data-layer.md](05-data-layer.md) — TanStack Query + TanStack DB on RN, offline cart/wishlist
6. [06-realtime.md](06-realtime.md) — Supabase Broadcast from RN, ElectricSQL non-fit on mobile
7. [07-navigation-deep-linking.md](07-navigation-deep-linking.md) — Expo Router, universal links, web parity
8. [08-push-notifications.md](08-push-notifications.md) — Expo push, order/cancel/return events
9. [09-shared-code.md](09-shared-code.md) — what to extract into shared packages, what NOT to
10. [10-build-deploy.md](10-build-deploy.md) — EAS Build, OTA, App Store / Play Store

### Cross-cutting: Payments

- [../payments/04-mobile-flow.md](../payments/04-mobile-flow.md) — **Read before building checkout.** Mobile payment intent flow via `/fo-mobile/` (Clerk JWT + device attestation, no HMAC). Same DTOs as the web contract; different path and controller.

## Non-negotiables (read before any code)

These come straight from the BO + FO `CLAUDE.md` invariants and govern everything:

1. **Auth separation** — Clerk only. Never reuse Supabase auth from BO. Never share a session token between FO web and FO mobile via deep link.
2. **`BO_WEBHOOK_SECRET` MUST NOT be bundled in the mobile binary.** Mobile bundles are extractable via static analysis. The web FO holds this secret server-side only — mobile cannot replicate that pattern. See [04-api-client.md](04-api-client.md) for the mobile-gateway solution.
3. **One NestJS backend.** Web FO, mobile FO, BO web, BO mobile all hit the same NestJS at `apps/api/`. No mobile-only NestJS instance, no duplicated routes. Mobile auth flows are added to existing controllers, not new ones.
4. **`/fo/*` is the only path FO mobile may touch.** Admin routes (`/2026-01/...`) are off-limits — the BO gateway and ApiKeyGuard reject them.
5. **Channel names are an API contract.** `store:{storeId}:{topic}` Supabase Broadcast channels are shared with web. Never rename without coordinating in both repos.
6. **The `@eshops/db` package is Node-only at runtime.** Mobile may import its **types** (compile-time), never its runtime modules (`createDrizzleSupabaseClient`, table definitions executed against PG). RN has no Postgres client and must not.
7. **No `'server-only'` modules ever cross into mobile.** `src/drizzle/schema.ts`, `src/libs/server-api-client.ts`, `/server/queries/`, `/server/actions/`, `next/cache` — all forbidden in the RN bundle.
8. **Mobile-first stays mobile-first.** The web FO is already mobile-first (>75% Vietnamese consumers on mobile). The native app exists to capture the *remaining* mobile-only affordances — push, offline, native checkout, deep links into the OS — not to re-implement the web. Don't ship a screen on mobile that the web already does well.

## What this integration is and is not

| Is | Is not |
| --- | --- |
| A native shell over the same NestJS backend the web FO already uses | A rewrite of FO business logic |
| A mobile-only set of affordances (push, offline cart, biometric auth, native payment, deep links) | A second checkout pipeline |
| A separate Expo repo (`KhanhStore-mobile/`) consuming `@eshops/db` types via npm workspace or git submodule | A folder inside the Next.js FO repo (mobile + web in one Next.js project is unsupported) |
| Clerk Expo SDK for auth — same Clerk org as web | A new identity system |

## Status

Vertical-1 (browse + cart) is wired against this design. See [`../../README.md`](../../README.md) for the live app status. Anything past Vertical-1 is being handled manually outside this folder.
