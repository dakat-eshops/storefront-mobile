# Wishlist — Mobile FO

Wishlist collection pattern for mobile.

## Documents

| File | Topic |
| --- | --- |
| [01-collection-pattern.md](01-collection-pattern.md) | TanStack DB collection, guest/authed split, toggle API, sign-in merge |

## Code

The runtime implementation lives alongside these docs (imported as `@/docs/wishlist/...`):

| File | Topic |
| --- | --- |
| [hooks/use-wishlist.ts](hooks/use-wishlist.ts) | `useWishlist` hook — toggle API, guest/authed read/write |
| [collections/storage.ts](collections/storage.ts) | MMKV read/write for the guest wishlist |
| [collections/queryKeys.ts](collections/queryKeys.ts) | TanStack Query keys |
| [types.ts](types.ts) | `WishlistItem` type |

## Key invariants

1. **Single-field rows.** Wishlist items are just `{ productId }` — no quantity, no price snapshot. Simpler than cart.
2. **Toggle API.** `wishlist.toggle(productId)` adds if absent, removes if present. No separate add/remove calls.
3. **Guest = MMKV collection.** Before sign-in, wishlist is stored in MMKV via `localStorageCollectionOptions` (key: `storefront-wishlist-items`).
4. **Authed = query collection.** After sign-in, wishlist is backed by the NestJS API via `queryCollectionOptions`.
5. **Merge on sign-in.** `WishlistSyncProvider` reads MMKV directly, posts to `/fo-mobile/stores/:storeId/me/wishlist/sync`, clears MMKV on success.
6. **No `onUpdate`.** Wishlist items are either present or absent — no update operation.

## Code map (current implementation)

| File | Purpose |
| --- | --- |
| [features/wishlist/collections/storage.ts](../../features/wishlist/collections/storage.ts) | MMKV wrapper, key `storefront-wishlist-items` |
| [features/wishlist/collections/queryKeys.ts](../../features/wishlist/collections/queryKeys.ts) | Query keys |
| [features/wishlist/hooks/use-wishlist.ts](../../features/wishlist/hooks/use-wishlist.ts) | `useWishlist` / `useIsWishlisted` / `useToggleWishlist` / `useRemoveFromWishlist` |
| [features/wishlist/types.ts](../../features/wishlist/types.ts) | `WishlistItem` (`{ productId, addedAt }`) |

> **Note — implementation is currently MMKV-only.** Invariants 4–5 above
> (authed query collection + `WishlistSyncProvider` merge) describe the design
> target, not shipped code: today guest AND authed users share the same MMKV
> store via plain `useQuery`, and no sync provider file exists yet. Mobile does
> not use TanStack DB `localStorageCollectionOptions` (RN has no `window`).

## Cross-references

- Cart pattern (reference implementation): [../_initial/05-data-layer.md](../_initial/05-data-layer.md)
- FO web wishlist for structural reference: [FO/KhanhStore/docs/wishlist/01-architecture.md](../../../../FO/KhanhStore/docs/wishlist/01-architecture.md)
