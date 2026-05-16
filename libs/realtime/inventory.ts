import type { RealtimeChannel } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { productQueryKeys } from '@/features/products/collections/queryKeys';
import { supabase } from '../supabase';

/**
 * `store:{storeId}:inventory` / event `inventory_update`.
 *
 * Wire contract (BO is source of truth — see
 * `BO/e-Shops/apps/api/src/modules/admin/inventories/inventories.service.ts`
 * and `BO/e-Shops/docs/features/supabase/BROADCAST_FANOUT_GUIDE.md`):
 *
 *   { itemId: string;       // product_items.id (the inventory row that changed)
 *     inStock: boolean;     // derived from newQty > 0
 *     newQty: number;       // absolute quantity after the mutation
 *     updatedAt: string }   // ISO-8601 commit timestamp
 *
 * The BO does NOT emit `productId` — this hook therefore cannot directly
 * invalidate a per-product detail entry. Two consequences:
 *
 *   1. We invalidate the products list (PLP badges, homepage tiles) on every
 *      event. The lists carry `isInStock`, so this is the cheapest correct fix.
 *   2. PDP refresh on a single item must be done by the screen subscribing
 *      separately (e.g. via a per-screen `useInventoryBroadcast` extension
 *      that knows its own `itemId → productId` mapping) OR by an in-cache
 *      patcher (see FO web: `src/features/category/collections/realtime.ts`).
 *
 * Audit history: prior version typed `payload as { productId, variantId,
 * branchId, inStock, qty }` and early-returned on `!p.productId`. Because
 * BO never sends `productId`, every event silently no-op'd. Fixed 2026-05-16.
 */
type InventoryUpdatePayload = {
  itemId: string;
  inStock: boolean;
  newQty: number;
  updatedAt: string;
};

export function useInventoryBroadcast(storeId: string | undefined) {
  const qc = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!storeId) return;

    const ch = supabase
      .channel(`store:${storeId}:inventory`)
      .on('broadcast', { event: 'inventory_update' }, ({ payload }) => {
        const p = payload as InventoryUpdatePayload;
        if (!p?.itemId) return;
        // PLP rows carry `isInStock` — invalidate lists so the badge re-renders.
        // We can't target a single product detail entry without an
        // `itemId → productId` mapping; defer that to per-screen subscribers.
        qc.invalidateQueries({ queryKey: productQueryKeys.lists() });
      })
      .subscribe();

    channelRef.current = ch;

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
