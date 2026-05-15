# 06 · Realtime (Supabase Broadcast)

The web FO already subscribes to Supabase Broadcast channels for inventory, price, promotion, and catalog events. Mobile uses the **same channels with the same payload contracts** — the only difference is React Native's `@supabase/supabase-js` client and connection lifecycle.

## Why Broadcast, not ElectricSQL or Postgres Changes

| Option | Verdict for FO mobile |
| --- | --- |
| **Supabase Broadcast** (NestJS fans out events on store-scoped channels) | ✅ Built for 1M DAU consumer fan-out. Channel-per-store. Already implemented for web. |
| **Supabase Postgres Changes** | ❌ Shared replication slot — cannot fan out to millions of mobile clients. Reserved for BO admin push notifications. |
| **ElectricSQL** | ❌ HMAC-signed shape URLs (binary-extraction problem). Designed for admin lists. 10K concurrent shape ceiling. |

The channel contract `store:{storeId}:{topic}` is stable. Renaming requires coordinated PRs in **BO (NestJS)**, **FO web**, and **FO mobile** — never unilateral.

## Connection setup

```ts
// libs/supabase.ts
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';   // required for supabase-js on RN

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: { persistSession: false },        // Clerk owns auth, not Supabase
    realtime: { params: { eventsPerSecond: 10 } },
  },
);
```

We disable Supabase Auth persistence because **Clerk is the identity system**. Supabase here is a transport for Broadcast only — RLS on broadcast channels uses the anon role (channel-level secret if needed, but the BO `realtimeFlags` already gate emission).

## Subscriber hook (per channel)

```ts
// libs/realtime/inventory.ts
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';
import { supabase } from '@/libs/supabase';
import { productQueryKeys } from '@/features/products/collections/queryKeys';
import { inventoryQueryKeys } from '@/features/inventory/collections/queryKeys';

type InventoryUpdatePayload = {
  productId: string;
  productSlug: string;
  itemInventoryId: string;
  quantity: number;       // new absolute quantity for this item inventory
  isInStock: boolean;     // true if any variant has quantity > 0
  totalQuantity: number;  // sum across all variants
};

export function useInventoryBroadcast(storeId: string) {
  const qc = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!storeId) return;

    const ch = supabase
      .channel(`store:${storeId}:inventory`)
      .on('broadcast', { event: 'inventory_update' }, ({ payload }) => {
        const p = payload as InventoryUpdatePayload;
        // Targeted invalidation — never blanket-invalidate
        qc.invalidateQueries({ queryKey: productQueryKeys.detail(p.productId) });
        qc.invalidateQueries({ queryKey: inventoryQueryKeys.byProduct(p.productId) });
      })
      .subscribe();

    channelRef.current = ch;

    // Reconnect on foreground — RN suspends WebSockets in background
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && channelRef.current?.state !== 'joined') {
        channelRef.current?.subscribe();
      }
    });

    return () => {
      sub.remove();
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [storeId, qc]);
}
```

Mount in a top-level provider that only runs when the user is on a store-scoped screen.

## Channels (mirrors web FO)

| Channel | Event | Action on mobile |
| --- | --- | --- |
| `store:{storeId}:inventory` | `inventory_update` | Invalidate product detail + inventory queries for that productId |
| `store:{storeId}:prices` | `price_update` | Invalidate price book queries; if user has the product in cart, also refetch cart to recompute total |
| `store:{storeId}:promotions` | `promotion_activated` / `promotion_deactivated` | Invalidate promotion list + catalog queries |
| `store:{storeId}:catalog` | `product_published` / `product_unpublished` | Invalidate catalog and product list queries |

## Payload safety reminder

Per BO `CLAUDE.md`:

> Never include `cost_price`, `margin`, `profile_id`, or raw DB row contents in Broadcast payloads. Only FO-safe fields.

Mobile is a FO surface — same rule. If a server-side change to a Broadcast payload starts leaking sensitive fields, the mobile app exposes them as much as the web does. Audit the NestJS `realtime.service.ts` emitters, not the mobile subscribers.

## Lifecycle rules

- **App backgrounded for >30s** → iOS closes the WebSocket. Always re-subscribe on `AppState === 'active'`.
- **Network change (Wi-Fi ↔ cellular)** → Supabase client auto-reconnects with backoff. Don't intervene.
- **Sign-out** → Tear down all channels (`supabase.removeAllChannels()`) before clearing the Clerk session so the next user doesn't receive events scoped to the previous user's profile (e.g., personalized promotions, if those ever ship).
- **Multiple channels** → Subscribe to all four at app start (inventory, prices, promotions, catalog). The cost is one WebSocket multiplexing all topics, not four.

## Feature flags gate emission, not subscription

The BO admin can toggle `broadcastInventory`, `broadcastPrices`, etc. per store. Mobile **always subscribes**; the server simply doesn't emit when the flag is off. There's no client-side flag to check.

## What mobile does NOT subscribe to

- `pgChangesOrders` — that's a BO admin Postgres Changes feed for new-order toasts. Not relevant to FO.
- Any channel not in the table above. Adding a new channel requires a coordinated PR in NestJS + FO web + FO mobile.

## Testing the subscriber

Run the FO mobile app, then in another shell trigger an inventory update via the BO admin or via a direct SQL update + `realtime.service.ts` emit. The mobile app should refetch the affected product within ~500ms. If it doesn't:

1. Confirm `realtimeFlags.broadcastInventory` is enabled for the store.
2. Confirm the channel name matches `store:${storeId}:inventory` exactly.
3. Confirm the device has network (foreground or not — Broadcast keeps connections alive only in foreground).
4. Confirm the WebSocket isn't being killed by a corporate VPN or strict NAT.
