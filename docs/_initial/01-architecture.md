# 01 · Architecture

## Repo placement — separate repo, not a folder

```
TheAstronaut/projects/e-commerce/
├── BO/e-Shops/                       # Next.js BO + NestJS API (apps/api/) + @eshops/db package
├── FO/KhanhStore/                    # Next.js FO web (existing)
└── FO/KhanhStore-mobile/             # ← NEW: Expo React Native app (this integration)
```

**Why a separate repo:**

- Next.js + Expo cannot share one `package.json` cleanly (different React reconcilers, `react-native` resolver collisions, `next/*` imports leak into Metro).
- The FO Next.js repo has heavy server dependencies (`server-only`, `next/cache`, PayloadCMS, Drizzle runtime) that must never appear in a Metro bundle.
- Build pipelines are different: Vercel for web, EAS for mobile. Coupling them slows both.
- The web FO is mobile-first already — the mobile app is **not** a port of the web; it is a thinner native shell with mobile-only affordances.

**What is shared:**

- `@eshops/db` package — **types only**, consumed via npm workspace link OR published to a private registry. Tables/Drizzle runtime never execute in RN.
- NestJS backend at `BO/e-Shops/apps/api/` — single source of truth for products, cart, orders, etc.
- Supabase Broadcast channel contract — `store:{storeId}:{topic}` event names are stable across web and mobile.
- Clerk organization — same user accounts work on web and mobile.

**What is NOT shared:**

- The Next.js `src/` tree. No `'use server'`, no `'use cache'`, no `next/image`, no `@/libs/server-api-client`.
- Tailwind classes. RN uses StyleSheet / NativeWind (Tailwind-for-RN, optional). Components are rebuilt for native.
- The `INTERNAL_API_KEY` and `FO_HMAC_SECRET` — see [04-api-client.md](04-api-client.md).

## Layered architecture (mobile)

```
┌─ React Native (Expo) ────────────────────────────────────────┐
│                                                                │
│  app/                          ← Expo Router screens          │
│  ├─ (auth)/sign-in.tsx                                        │
│  ├─ (tabs)/                                                   │
│  │  ├─ index.tsx               ← Home                         │
│  │  ├─ search.tsx                                             │
│  │  ├─ cart.tsx                                               │
│  │  └─ account.tsx                                            │
│  ├─ products/[slug].tsx                                       │
│  └─ checkout/                                                 │
│                                                                │
│  features/[entity]/            ← mirrors web FO feature dirs  │
│  ├─ collections/               ← TanStack DB + queryKeys      │
│  ├─ hooks/                     ← useQuery / useLiveQuery      │
│  └─ components/                ← RN-native components         │
│                                                                │
│  libs/                                                         │
│  ├─ api-client.ts              ← mobile gateway client        │
│  ├─ clerk.ts                   ← Clerk Expo provider          │
│  ├─ supabase.ts                ← Broadcast subscriber only    │
│  ├─ secure-store.ts            ← Expo SecureStore wrapper     │
│  └─ realtime.ts                ← topic subscribers            │
└────────────────────────────────────────────────────────────────┘
                              │
                              │  HTTPS, JSON, Clerk JWT Bearer
                              ▼
┌─ Mobile Auth Gateway (NestJS, /2026-01/fo-mobile/...) ───────┐
│  • ClerkMobileGuard — verifies Clerk session token           │
│  • DeviceAttestationGuard — App Attest (iOS) / Play Integrity│
│  • Per-user rate limiter                                     │
│  • Forwards to existing /fo/* handlers internally            │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
                  Existing FO services (read paths)
                              │
                              ▼
                       Supabase Postgres (RLS)
```

## What runs where

| Layer | Web FO | Mobile FO |
| --- | --- | --- |
| Auth | Clerk Next.js SDK | Clerk Expo SDK |
| API client | `serverApi` (HMAC + Clerk, server-only) | `api-client.ts` (Clerk JWT + device attestation, no HMAC) |
| Read paths | `'use cache'` server queries + TanStack Query on client | TanStack Query + TanStack DB only |
| Cart / wishlist (guest) | `localStorageCollectionOptions` from `@tanstack/db` | `localStorageCollectionOptions` from `@tanstack/db` with an MMKV-backed `Storage` shim — TanStack DB has no first-party RN driver; we provide a synchronous adapter |
| Cart / wishlist (auth) | `queryCollectionOptions` → BO web `/api/cart/sync` | `queryCollectionOptions` → mobile gateway `/cart/sync` |
| Realtime | `useEffect` + `@supabase/supabase-js` | Same — Supabase JS SDK works on RN |
| Image | `next/image` + `@unpic/react` | `expo-image` |
| Cache layer | Next.js `'use cache'` + CDN | TanStack Query cache + Expo MMKV persister |

## Why no ElectricSQL on mobile

ElectricSQL is admin-only (BO web). It requires:
- A persistent WebSocket to ElectricSQL Cloud.
- Per-store HMAC-signed shape URLs minted by the BO gatekeeper.
- A SQLite-backed local store with conflict-free replication.

For FO mobile:
- The audience is consumers, not admins. Row-level reactivity on product lists is overkill.
- Shape URLs are signed with `ELECTRIC_SHAPE_SECRET` — same binary-extraction problem as HMAC.
- The 10K concurrent shape ceiling does not scale to consumer DAU.

Instead, FO mobile uses **Supabase Broadcast** (already the FO web pattern) for inventory / price / promotion / catalog events. See [06-realtime.md](06-realtime.md).

## Versioning

The mobile app calls `/2026-01/fo-mobile/...`. The `2026-01` segment is the NestJS API version (`@Controller({ version: '2026-01', path: 'fo-mobile/...' })`) — `fo-mobile/` lives in `path`, never in `version`, mirroring the existing `/2026-01/fo/...` convention (see BO `CLAUDE.md`). When a breaking change ships:
- NestJS adds `/2026-02/fo-mobile/...` alongside the old version.
- Old binaries continue to work on `2026-01` for a deprecation window.
- New OTA / store builds switch to `2026-02`.
- Never break a published binary's API version — users on slow update cycles will stay on it for months.
