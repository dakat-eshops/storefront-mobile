# KhanhStore Mobile (FO React Native)

Expo React Native storefront — sibling app to `FO/KhanhStore` (web). Same NestJS
backend, same Clerk identity, same `@eshops/db` types. Implements the design in
[`docs/`](./docs/_initial/README.md).

## Status

Vertical-1 (browse + cart) wired:

- App shell with 4 tabs: Home / Search / Cart / Account
- Product list (PLP) + product detail (PDP) via `/fo-mobile/2026-01/.../products`
- MMKV-backed offline cart with optimistic add / qty / remove
- Clerk sign-in modal + guest ↔ authed cart sync on sign-in
- TanStack Query with MMKV persister (offline-first reads)
- BO side: `FoMobileModule` with `ClerkMobileGuard` + `DeviceAttestationGuard`,
  reusing existing FO service classes

Not yet wired (next iterations): checkout, orders history, cancel/return flows,
wishlist, push notifications, Supabase Broadcast subscribers, App Attest /
Play Integrity verification in `DeviceAttestationGuard`.

## Auth model — the non-negotiable

This app **never** ships an HMAC secret. The web FO authenticates to NestJS
`/fo/*` with HMAC + per-store secret, but a mobile binary is statically
analysable and that pattern cannot be replicated safely. Instead this app
talks to **`/fo-mobile/2026-01/stores/:storeId/*`** — a parallel set of NestJS
controllers protected by:

1. `ClerkMobileGuard` — optional Clerk JWT (anonymous fallback allowed)
2. `DeviceAttestationGuard` — `x-device-attestation` header (iOS App Attest /
   Android Play Integrity). Currently dev-mode-permissive; production
   verification against Apple/Google JWKs is tracked in
   [`docs/_initial/04-api-client.md`](./docs/_initial/04-api-client.md).

The global `ApiKeyGuard` skips both `/fo/*` and `/fo-mobile/*` paths.

## Layout

```text
app/
  _layout.tsx                  # ClerkProvider → PersistQueryClient → CartSync → Stack
  (tabs)/
    _layout.tsx                # Home / Search / Cart / Account
    index.tsx                  # Featured PLP
    search.tsx                 # Search PLP
    cart.tsx                   # Cart screen
    account.tsx                # Clerk auth state + sign-out
  product/[id].tsx             # PDP (Stack route)
  sign-in.tsx                  # Modal sign-in (Clerk Expo)
features/
  products/
    collections/queryKeys.ts   # Source of truth for product query keys
    hooks/use-products.ts      # useProductList (infinite) + useProductDetail
    components/product-card.tsx
    utils/format-price.ts
    types.ts
  cart/
    collections/queryKeys.ts
    collections/storage.ts     # MMKV guest cart (key: kuden-cart-items)
    components/cart-sync-provider.tsx
    hooks/use-cart.ts          # useCart / useAddToCart / useUpdate / useRemove
    types.ts
libs/
  api-client.ts                # useApiClient → /fo-mobile/<version>/stores/<storeId>
  clerk-token-cache.ts         # SecureStore-backed Clerk session cache
  device-attestation.ts        # App Attest / Play Integrity hook
  env.ts                       # Typed EXPO_PUBLIC_* access
  query-client.ts              # MMKV-persisted TanStack Query client
  supabase.ts                  # Shared Supabase JS client (Broadcast only)
  realtime/                    # Broadcast subscribers (inventory etc.)
```

## Dev setup

```bash
pnpm install
cp .env.example .env           # fill in EXPO_PUBLIC_* values
pnpm start
```

Required env vars:

| Var | Notes |
| --- | --- |
| `EXPO_PUBLIC_API_BASE_URL` | NestJS base URL (e.g. `http://localhost:4000`) |
| `EXPO_PUBLIC_API_VERSION` | Defaults to `2026-01` |
| `EXPO_PUBLIC_DEFAULT_STORE_ID` | Per-tenant store UUID |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Same Clerk org as web FO |
| `EXPO_PUBLIC_SUPABASE_URL` | For Broadcast subscribers |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Read-only anon key |
| `EXPO_PUBLIC_APP_VERSION` | Cache buster for the persisted query client |

`react-native-app-integrity` does NOT run in Expo Go. Use a dev client:

```bash
pnpm expo run:ios       # or pnpm expo run:android
```

`DeviceAttestationGuard` accepts `__unsupported__` outside production so you
can hit `/fo-mobile/*` from a simulator. In production it rejects.

## Hard rules (from `docs/_initial/README.md` § Non-negotiables)

1. **Never bundle `FO_HMAC_SECRET`.** Mobile talks to `/fo-mobile/*`, never `/fo/*`.
2. **One NestJS backend** — `/fo-mobile/*` reuses the existing `FoXxxService`
   classes; new controllers are guards-only.
3. **Channel names are an API contract** — Supabase Broadcast topics
   (`store:{storeId}:{topic}`) must stay in lock-step with the web FO repo.
4. **`@eshops/db` is Node-only at runtime** — types-only imports allowed,
   never call its runtime functions from RN.
5. **No `'server-only'` modules cross into mobile** — no Next.js cache, no
   `serverApi`, no `/server/queries/`.

## Reading order before changing anything

1. [`docs/_initial/README.md`](./docs/_initial/README.md)
2. [`docs/_initial/04-api-client.md`](./docs/_initial/04-api-client.md) — the HMAC problem and the mobile gateway
3. [`docs/_initial/05-data-layer.md`](./docs/_initial/05-data-layer.md) — TanStack Query + cart pattern
4. `BO/e-Shops/CLAUDE.md` and `FO/KhanhStore/CLAUDE.md` for cross-system invariants

## Original Expo starter notes

This project was bootstrapped with `create-expo-app`. The default
`reset-project` script is preserved for emergency restart but should not be
needed — the demo content has been replaced by the FO storefront vertical
above.
