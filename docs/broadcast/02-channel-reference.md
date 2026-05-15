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

### `inventory_update`

```ts
interface InventoryUpdatePayload {
  productId: string;
  productSlug: string;
  itemInventoryId: string;
  quantity: number;          // new absolute quantity
  isInStock: boolean;        // true if any variant has quantity > 0
  totalQuantity: number;     // sum across all variants
}
```

### `price_update`

```ts
interface PriceUpdatePayload {
  productId: string;
  productSlug: string;
  itemInventoryId: string;   // the specific variant
  priceBookId: string;
  price: number;             // new price in VND (integer)
  compareAtPrice?: number;   // original price if on discount
}
```

### `promotion_activated` / `promotion_deactivated`

```ts
interface PromotionPayload {
  promotionId: string;
  title: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  applicableProductIds: string[];   // empty = applies to all products in store
}
```

### `product_published` / `product_unpublished`

```ts
interface CatalogPayload {
  productId: string;
  productSlug: string;
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
