# 09 · Shared Code

The rule is conservative: share **types and pure logic**, never runtime modules that touch Next.js, Drizzle runtime, server-only APIs, or browser-only APIs. When in doubt, copy. A duplicated 30-line Zod schema is cheaper than a leaky shared package.

## What to share

| Category | Examples | How to share |
| --- | --- | --- |
| **DB row types** | `Product`, `Order`, `CartItem` (compile-time only) | Split `@eshops/db` into `@eshops/db` (runtime, Node) + `@eshops/db-types` (zero-runtime, RN-safe). Mobile imports `@eshops/db-types`. |
| **API DTO schemas** | Zod schemas for `CreateOrderDto`, `UpdateCartItemDto` | Extract from `apps/api/src/modules/fo/**/dto/` into `@eshops/api-contracts` (a new package). Both web FO and mobile FO consume it. |
| **Pure utilities** | `formatVND`, `slugify`, `computeLoyaltyRestore`, `formatPhoneVN` | New package `@khanhstore/utils` — pure functions, no IO, no React. |
| **Constants** | `API_VERSION`, channel name builders `inventoryChannel(storeId)`, error codes | Same package as utils. |
| **Domain enums** | order status, role names | Re-export from `@eshops/db-types`. |
| **i18n message catalogs** | Vietnamese / English strings | New package `@khanhstore/i18n`. |

## What NOT to share

| Anti-pattern | Why |
| --- | --- |
| `@eshops/db` runtime entrypoint | Drizzle execute paths require `node:`, `pg`. Will crash Metro at bundle time (or worse, ship a 4MB shim). |
| `src/libs/server-api-client.ts` (FO web) | Imports `next/headers`, `'server-only'`. Holds `BO_WEBHOOK_SECRET`. |
| `src/features/[entity]/server/queries/` | `'use cache'` is Next.js-only. Has no meaning in RN. |
| `src/features/[entity]/server/actions/` | `'use server'` is Next.js-only. |
| React components (web → mobile) | DOM ≠ RN. `<div>` is `<View>`, `<img>` is `<Image>`, no CSS classes. Component code does NOT survive the port. |
| `next/image`, `next/link`, `next/navigation` | Web-only. Use Expo equivalents (`expo-image`, `expo-router`). |
| Tailwind class names (without NativeWind) | RN has no class system without NativeWind. Even with NativeWind, web-tested classes don't map 1:1. |
| Logger (`pino`) | pino has Node dependencies. RN uses Sentry or a thin wrapper. |
| Anything importing `next/*` | Always web-only. |

## Recommended package split

Today, `@eshops/db` is a Node-only Drizzle package. Adding mobile means splitting it:

```
packages/
├── db/                          # @eshops/db — Node runtime (Drizzle, server-only via BO re-export)
│   ├── src/
│   │   ├── client.ts            # createDrizzleSupabaseClient (Node only)
│   │   ├── tables/              # table definitions (Node only)
│   │   └── ...
│   └── package.json             # main: dist/index.js
│
├── db-types/                    # @eshops/db-types — types only, RN-safe
│   ├── src/
│   │   ├── index.ts             # re-exports types from @eshops/db
│   │   └── relations.ts         # if relation types are needed
│   └── package.json
│       # No "main" — types-only package, or "main": "./dist/index.js" with literally just type re-exports
│
└── api-contracts/               # @eshops/api-contracts — Zod schemas + inferred types for FO + mobile gateway
    ├── src/
    │   ├── fo/
    │   │   ├── products.ts      # ListProductsDto, ProductDto, etc.
    │   │   ├── cart.ts
    │   │   └── orders.ts
    │   └── index.ts
    └── package.json
```

The split is a one-time refactor in `BO/e-Shops/`. Until it lands, the mobile app:

1. Path-aliases just the type modules of `@eshops/db` (see [02-setup.md](02-setup.md) `tsconfig.json` and `metro.config.js` `blockList`).
2. Copy-pastes Zod schemas it needs, with a TODO to migrate to `@eshops/api-contracts` once it exists.

This is slightly painful for the first month and pays off over the next 12 months.

## Symbol-level rules

- A shared module **must compile in a pure ESM browser context** (no `process.env` reads at module top level, no `require('fs')`, no React Server Components markers).
- A shared module **must not transitively import** anything from `next/*`, `drizzle-orm`, `pg`, `@payloadcms/*`, `'server-only'`.
- ESLint rule (recommended): add a `no-restricted-imports` block to the mobile project that errors on any import from `@/server/*`, `@/libs/server-*`, `next/*`, `drizzle-orm`, `@eshops/db` (the runtime entrypoint). Metro's `blockList` catches bundle-time; ESLint catches at edit-time.

## Refactor sequencing

Order matters — pick the path that doesn't block mobile work:

1. **Day 0** (in BO repo): Create `@eshops/db-types` with re-exports. No source changes, just a new entrypoint. ~1 hour of build config.
2. **Day 0** (in mobile repo): Set up `tsconfig.json` paths to point at `@eshops/db-types`. Start building.
3. **Week 2** (in BO repo): Extract FO Zod DTOs into `@eshops/api-contracts`. Update NestJS FO controllers + FO web to import from the new package. Mobile picks it up.
4. **Week 4** (in mobile repo): Replace any copy-pasted DTOs with `@eshops/api-contracts` imports.
5. **As needed**: Extract pure utilities into `@khanhstore/utils` only when both web FO and mobile FO need the same one. Don't preemptively extract.

## Channel name and event name constants — share early

The Supabase Broadcast channel contract (`store:{storeId}:{topic}`) is brittle to drift. Extract these into `@khanhstore/utils` (or a small `@khanhstore/realtime-contract` package) **on day one**:

```ts
// @khanhstore/utils/realtime.ts
export const channels = {
  inventory: (storeId: string) => `store:${storeId}:inventory`,
  prices:    (storeId: string) => `store:${storeId}:prices`,
  promotions:(storeId: string) => `store:${storeId}:promotions`,
  catalog:   (storeId: string) => `store:${storeId}:catalog`,
} as const;

export const events = {
  inventoryUpdate:      'inventory_update',
  priceUpdate:          'price_update',
  promotionActivated:   'promotion_activated',
  promotionDeactivated: 'promotion_deactivated',
  productPublished:     'product_published',
  productUnpublished:   'product_unpublished',
} as const;
```

NestJS emitters, FO web subscribers, and FO mobile subscribers all import the same constants. One typo, one place to fix.

## A note on monorepo vs separate repos

You can technically pull the mobile app **into** `BO/e-Shops/` as `apps/mobile-fo/`. We recommend against it because:

- FO mobile and BO are owned by different release trains; coupling them via one git history means feature branches conflict.
- The web FO is already a separate repo (`FO/KhanhStore/`) — putting mobile FO under BO is weirder than putting it under FO.
- Most teams want the FO mobile app to be a standalone product with its own CI / EAS budget.

If you do want one monorepo across BO + FO + mobile-FO + mobile-BO + shared packages, the layout is:

```
e-commerce/
├── apps/
│   ├── bo-web/                # current BO/e-Shops/
│   ├── api/                   # current BO/e-Shops/apps/api/
│   ├── fo-web/                # current FO/KhanhStore/
│   ├── fo-mobile/             # new
│   └── bo-mobile/             # new (later)
└── packages/
    ├── db/
    ├── db-types/
    └── api-contracts/
```

That's a separate, larger refactor. Out of scope for this integration.
