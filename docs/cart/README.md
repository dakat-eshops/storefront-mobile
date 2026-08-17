# Cart — docs

Documentation for the mobile cart screen and its checkout-selection feature.

## Documents

| File | Topic |
| --- | --- |
| [01-selection-hook.md](./01-selection-hook.md) | `useCartSelection` — ephemeral Shopee-style item selection hook, RN-specific differences from web FO |
| [02-checkout-handoff.md](./02-checkout-handoff.md) | Cross-step state handoff via Zustand `useCheckoutStore` — the mobile equivalent of web FO's `sessionStorage` approach |

## Context

The web FO (`FO/KhanhStore`) shipped a Shopee-style cart selection feature:

- Users select which items to buy before proceeding to checkout.
- Selection is ephemeral (resets on refresh/re-mount).
- Selected item IDs cross the Cart → Delivery → Payment route boundary via `sessionStorage`.
- After a successful order only the ordered items are removed from the cart; the rest stay.

Mobile needs the same UX but uses different primitives:

| Concern | Web FO | Mobile |
| --- | --- | --- |
| Selection state | `useState(Set<string>)` | `useState(Set<string>)` — identical |
| Cross-step handoff | `sessionStorage` (`checkout-selection.ts`) | Zustand `useCheckoutStore.selectedItemIds` |
| Checkbox indeterminate | Native HTML `input.indeterminate = true` via ref | Custom 3-state icon (RN has no native indeterminate checkbox) |
| Sticky bottom bar | CSS `position: fixed; bottom: 0` | Absolute-positioned `View` inside `SafeAreaView` |
| Navigation target | `router.push('/delivery')` | `router.push('/checkout/shipping')` |
| Post-order item removal | `cart.removeItem(id)` per ordered item | `useRemoveCartItem().mutateAsync(id)` per ordered item |
| Cart item qty field | `item.quantity` | `item.qty` (mobile `CartStorageItem` uses `qty`) |

## Code map (current implementation)

| File | Purpose |
| --- | --- |
| [features/cart/collections/storage.ts](../../features/cart/collections/storage.ts) | MMKV wrapper (`readCart` / `writeCart` / `clearCart`), key `storefront-cart-items` |
| [features/cart/collections/queryKeys.ts](../../features/cart/collections/queryKeys.ts) | Query keys |
| [features/cart/hooks/use-cart.ts](../../features/cart/hooks/use-cart.ts) | `useCart` + add/qty/remove mutations — MMKV-local for guest AND authed (see note) |
| [features/cart/hooks/use-cart-selection.ts](../../features/cart/hooks/use-cart-selection.ts) | Shopee-style selection ([01-selection-hook.md](./01-selection-hook.md)) |
| [features/cart/components/cart-sync-provider.tsx](../../features/cart/components/cart-sync-provider.tsx) | Guest→authed sync provider (currently invalidate-only, see note) |
| [features/cart/types.ts](../../features/cart/types.ts) | `CartStorageItem` (`qty`, not `quantity`) |

> **Note — server cart migration pending.** Mobile does NOT use TanStack DB
> collections (RN has no `window` for the browser collection driver) — the cart
> is a plain MMKV store read through `useQuery`. BO-side `/fo-mobile/cart`
> endpoints (Redis-backed + `POST /cart/sync`) now exist in
> `apps/api/src/modules/fo-mobile/cart/`, but the client hooks are still
> 100% MMKV-local. When migrating: authed reads → `GET /cart`, mutations →
> `/cart/items`, sync provider → real `POST /cart/sync` + clear MMKV on success.

## Cross-references

- [../checkout/01-flow.md](../checkout/01-flow.md) — Checkout state machine, Zustand store, navigation guards
- [../checkout/04-review-confirm.md](../checkout/04-review-confirm.md) — Where `selectedItemIds` is consumed for the order payload
- [../../features/cart/hooks/use-cart.ts](../../features/cart/hooks/use-cart.ts) — `useRemoveCartItem` (used for post-order cleanup)
- Web FO reference: [FO/KhanhStore/docs/commerce/cart/](../../../KhanhStore/docs/commerce/cart/README.md) — web implementation to keep in sync with
