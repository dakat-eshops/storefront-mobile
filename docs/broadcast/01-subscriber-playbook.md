# 01 · Broadcast Subscriber Playbook

## Supabase client setup

```ts
// libs/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: { persistSession: false },   // Clerk owns auth — Supabase only for Realtime
  },
);
```

## Base subscriber hook

```ts
// libs/realtime/use-broadcast-channel.ts
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '../supabase';

interface UseBroadcastChannelOptions<T> {
  channel: string;
  event: string;
  onMessage: (payload: T) => void;
  onReconnect?: () => void;
  enabled?: boolean;
}

export function useBroadcastChannel<T>({
  channel,
  event,
  onMessage,
  onReconnect,
  enabled = true,
}: UseBroadcastChannelOptions<T>) {
  const onMessageRef = useRef(onMessage);
  const onReconnectRef = useRef(onReconnect);
  const isFirstConnection = useRef(true);

  useEffect(() => {
    onMessageRef.current = onMessage;
    onReconnectRef.current = onReconnect;
  });

  useEffect(() => {
    if (!enabled) return;

    const sub = supabase
      .channel(channel)
      .on('broadcast', { event }, (payload) => {
        onMessageRef.current(payload.payload as T);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (isFirstConnection.current) {
            isFirstConnection.current = false;
          } else {
            // Reconnect — events may have been missed
            onReconnectRef.current?.();
          }
        }
      });

    // AppState: reconnect + full reconcile when coming back to foreground
    const appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        // Trigger reconciliation — the channel will reconnect automatically via Supabase SDK
        onReconnectRef.current?.();
      }
    });

    return () => {
      supabase.removeChannel(sub);
      appStateSub.remove();
    };
  }, [channel, event, enabled]);
}
```

## setQueryData patch pattern (inventory)

On a `inventory_update` message, surgically patch only the changed product in the query cache:

```ts
// features/product/collections/realtime.ts
export function useProductInventoryRealtime({
  storeId,
  enabled = true,
}: {
  storeId: string;
  enabled?: boolean;
}) {
  const queryClient = useQueryClient();

  useBroadcastChannel<InventoryUpdatePayload>({
    channel: `store:${storeId}:inventory`,
    event: 'inventory_update',
    onMessage: (payload) => {
      // Patch product detail query
      queryClient.setQueryData<Product>(
        productQueryKeys.detail(payload.productSlug),
        (old) => {
          if (!old) return old;
          return patchProductInventory(old, payload);
        },
      );

      // Patch product in list queries (if cached)
      queryClient.setQueriesData<ProductListResponse>(
        { queryKey: productQueryKeys.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((p) =>
              p.id === payload.productId ? patchProductInventory(p, payload) : p,
            ),
          };
        },
      );
    },
    onReconnect: () => {
      // Full reconcile: invalidate so the next render fetches fresh data
      queryClient.invalidateQueries({ queryKey: productQueryKeys.lists() });
    },
    enabled,
  });
}
```

## Price patch pattern

```ts
export function useProductPriceRealtime({
  storeId,
  enabled = true,
}: {
  storeId: string;
  enabled?: boolean;
}) {
  const queryClient = useQueryClient();

  useBroadcastChannel<PriceUpdatePayload>({
    channel: `store:${storeId}:prices`,
    event: 'price_update',
    onMessage: (payload) => {
      queryClient.setQueryData<Product>(
        productQueryKeys.detail(payload.productSlug),
        (old) => (old ? patchProductPrice(old, payload) : old),
      );
    },
    onReconnect: () => {
      queryClient.invalidateQueries({ queryKey: productQueryKeys.lists() });
    },
    enabled,
  });
}
```

## Pure patch functions (shared)

```ts
// libs/realtime/patches.ts
export function patchProductInventory(product: Product, payload: InventoryUpdatePayload): Product {
  return {
    ...product,
    isInStock: payload.isInStock,
    totalQuantity: payload.totalQuantity,
    itemInventories: product.itemInventories.map((inv) =>
      inv.id === payload.itemInventoryId
        ? { ...inv, quantity: payload.quantity }
        : inv,
    ),
  };
}

export function patchProductPrice(product: Product, payload: PriceUpdatePayload): Product {
  return {
    ...product,
    itemPriceBooks: product.itemPriceBooks.map((pb) =>
      pb.itemInventoryId === payload.itemInventoryId
        ? { ...pb, price: payload.price }
        : pb,
    ),
  };
}
```

Keep these functions pure and side-effect-free — they are called inside `setQueryData` which runs synchronously.

## Where to mount realtime hooks

Realtime subscriber hooks must run continuously while the relevant screen is mounted. Mount them in the screen component (or a dedicated provider) that renders the product data:

```tsx
// app/(tabs)/index.tsx — homepage
export default function HomeScreen() {
  const storeId = process.env.EXPO_PUBLIC_STORE_ID!;

  // Real-time patches for PDP and home
  useProductInventoryRealtime({ storeId, enabled: true });
  useProductPriceRealtime({ storeId, enabled: true });

  return <HomeContent />;
}
```

Unmount automatically handles channel cleanup via the `useEffect` return function.
