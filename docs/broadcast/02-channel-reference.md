# 02 · Channel Reference

All Supabase Broadcast channels published by the BO NestJS API.

## Channel map

| Channel | Supabase channel name | Events |
| --- | --- | --- |
| Inventory | `store:{storeId}:inventory` | `inventory_update` |
| Prices | `store:{storeId}:prices` | `price_update` |
| Promotions | `store:{storeId}:promotions` | `promotion_activated`, `promotion_deactivated` |
| Catalog | `store:{storeId}:catalog` | `product_published`, `product_unpublished` |

## Payload schemas

> **Corrected 2026-05-16.** The previous shapes on this page were aspirational and did NOT match what BO emits. The schemas below mirror the BO `RealtimeService` calls in `apps/api/src/modules/admin/inventories/inventories.service.ts` and `price-books.service.ts` byte-for-byte. The FO web canonical mirror is [`FO/KhanhStore/src/libs/realtime/payloads.ts`](../../../../FO/KhanhStore/src/libs/realtime/payloads.ts) — keep these three in lock-step.

### `inventory_update`

```ts
interface InventoryUpdatePayload {
  /** product_items.id (the inventory row that changed) — NOT a product id. */
  itemId: string;
  /** Convenience flag derived from newQty > 0. */
  inStock: boolean;
  /** Absolute quantity-on-hand on this item after the BO mutation. */
  newQty: number;
  /** ISO-8601 timestamp the BO mutation committed. */
  updatedAt: string;
}
```

> **Mobile note.** BO does NOT emit `productId`. The mobile inventory hook in
> [`libs/realtime/inventory.ts`](../../libs/realtime/inventory.ts) therefore
> can only invalidate the products **list** queries on its own. A per-product
> detail invalidation requires the consuming screen to maintain an
> `itemId → productId` map (or to use an in-cache patcher, like the FO-web
> pattern at `FO/KhanhStore/src/features/category/collections/realtime.ts`).

### `price_update`

```ts
interface PriceUpdatePayload {
  productId: string;
  /** Store-currency minor units (e.g. VND whole; USD cents). */
  newPrice: number;
  currency: string;
  priceBookId: string;
  effectiveAt: string;
}
```

### `promotion_activated` / `promotion_deactivated`

```ts
interface PromotionEventPayload {
  promotionId: string;
  name: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  expiresAt: string | null;
}
```

### `product_published` / `product_unpublished`

```ts
interface CatalogEventPayload {
  productId: string;
  slug: string;
  action: 'published' | 'unpublished';
}
```

## Feature flag gating

Each channel is gated by a per-store feature flag in Redis (set via BO Settings → Realtime). If the flag is off, the NestJS service does not publish to the channel. Mobile subscribes regardless — it just won't receive messages when the flag is off.

| Flag | Controls |
| --- | --- |
| `broadcastInventory` | `inventory_update` |
| `broadcastPrices` | `price_update` |
| `broadcastPromotions` | `promotion_activated` / `promotion_deactivated` |
| `broadcastCatalog` | `product_published` / `product_unpublished` |

## Payload stability contract

These payload shapes are a verbatim mirror of the BO `BROADCAST_FANOUT_GUIDE.md §5`. **Never** change field names or types on mobile alone — any change requires a coordinated PR in:

1. BO NestJS service (publish side)
2. FO web `src/libs/realtime/payloads.ts`
3. Mobile `libs/realtime/payloads.ts`

Adding new optional fields is safe (mobile ignores unknown fields). Removing or renaming existing fields is a breaking change.
