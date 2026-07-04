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
// libs/realtime/inventory.ts (simplified — see the file for the real payload)
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/libs/supabase';
import { productQueryKeys } from '@/features/products/collections/queryKeys';
import { useAppActiveGate } from './use-app-active';

export function useInventoryBroadcast(storeId: string | undefined) {
  const qc = useQueryClient();
  // Connection budget: true while foregrounded; flips false ~3s after
  // backgrounding, which tears the channel down via the effect cleanup.
  const appActive = useAppActiveGate();
  const hadSubscribedRef = useRef(false);

  useEffect(() => {
    if (!(storeId && appActive)) return;

    if (hadSubscribedRef.current) {
      // Rejoin after teardown — Broadcast is best-effort, so reconcile
      // whatever was missed while backgrounded.
      qc.invalidateQueries({ queryKey: productQueryKeys.lists() });
    }

    const ch = supabase
      .channel(`store:${storeId}:inventory`)
      .on('broadcast', { event: 'STOCK_UPDATE' }, ({ payload }) => {
        qc.invalidateQueries({ queryKey: productQueryKeys.lists() });
      })
      .subscribe();
    hadSubscribedRef.current = true;

    return () => {
      supabase.removeChannel(ch);
    };
  }, [storeId, appActive, qc]);
}
```

Mount in a top-level provider that only runs when the user is on a store-scoped screen. The shared gate lives in [`libs/realtime/use-app-active.ts`](../../libs/realtime/use-app-active.ts) — every subscriber hook must compose it; never hold a channel open while the app is backgrounded.

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

- **Connection budget (app background)** → `useAppActiveGate` flips `false` ~3s (`APP_ACTIVE_GRACE_MS`) after the app leaves `active`; every subscriber effect tears its channel down then. Supabase bills on **peak concurrent connections** — a backgrounded app must not hold one. Don't rely on the OS killing the socket (~30s on iOS); teardown is explicit and immediate server-side.
- **App foregrounded** → the gate flips `true`, the effects re-run, channels rejoin, and each hook invalidates the products list once to reconcile events missed while torn down (Broadcast is best-effort; there is no replay).
- **Network change (Wi-Fi ↔ cellular)** → Supabase client auto-reconnects with backoff. Don't intervene.
- **Sign-out** → Tear down all channels (`supabase.removeAllChannels()`) before clearing the Clerk session so the next user doesn't receive events scoped to the previous user's profile (e.g., personalized promotions, if those ever ship).
- **Multiple channels** → Subscribe to all topics while foregrounded (inventory, prices, catalog). The cost is one WebSocket multiplexing all topics, not one per topic.

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
