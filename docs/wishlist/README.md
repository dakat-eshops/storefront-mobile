# Wishlist — Mobile FO

Wishlist collection pattern for mobile.

## Documents

| File | Topic |
| --- | --- |
| [01-collection-pattern.md](01-collection-pattern.md) | TanStack DB collection, guest/authed split, toggle API, sign-in merge |

## Key invariants

1. **Single-field rows.** Wishlist items are just `{ productId }` — no quantity, no price snapshot. Simpler than cart.
2. **Toggle API.** `wishlist.toggle(productId)` adds if absent, removes if present. No separate add/remove calls.
3. **Guest = MMKV collection.** Before sign-in, wishlist is stored in MMKV via `localStorageCollectionOptions` (key: `kuden-wishlist-items`).
4. **Authed = query collection.** After sign-in, wishlist is backed by the NestJS API via `queryCollectionOptions`.
5. **Merge on sign-in.** `WishlistSyncProvider` reads MMKV directly, posts to `/fo-mobile/stores/:storeId/me/wishlist/sync`, clears MMKV on success.
6. **No `onUpdate`.** Wishlist items are either present or absent — no update operation.

## Cross-references

- Cart pattern (reference implementation): [../_initial/05-data-layer.md](../_initial/05-data-layer.md)
- FO web wishlist for structural reference: [FO/KhanhStore/docs/wishlist_feature/01-architecture.md](../../../../FO/KhanhStore/docs/wishlist_feature/01-architecture.md)
