import type { RealtimeChannel } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { productQueryKeys } from '@/features/products/collections/queryKeys';
import { supabase } from '../supabase';

/**
 * `store:{storeId}:inventory` — events OUT_OF_STOCK | LOW_STOCK | STOCK_UPDATE.
 *
 * Wire contract (BO is source of truth — see
 * `BO/e-Shops/apps/api/src/modules/admin/inventories/inventories.service.ts`
 * and `BO/e-Shops/docs/feature-inventory/03-realtime-channels.md`):
 *
 *   { itemId: string;       // product_items.id (the inventory row that changed)
 *     inStock: boolean;     // derived from newQty > 0
 *     newQty: number;       // absolute quantity after the mutation
 *     updatedAt: string }   // ISO-8601 commit timestamp
 *
 * All three event names carry the same payload shape. The BO does NOT emit
 * `productId`, so this hook cannot target a single detail entry — it invalidates
 * the products list so PLP badges and homepage tiles re-render with fresh stock.
 * For per-product PDP patching see FO web: `features/category/collections/realtime.ts`.
 */
type InventoryUpdatePayload = {
  itemId: string;
  inStock: boolean;
  newQty: number;
  updatedAt: string;
};

type InventoryEventName = 'OUT_OF_STOCK' | 'LOW_STOCK' | 'STOCK_UPDATE';

const INVENTORY_EVENTS: InventoryEventName[] = [
  'OUT_OF_STOCK',
  'LOW_STOCK',
  'STOCK_UPDATE',
];

export function useInventoryBroadcast(storeId: string | undefined) {
  const qc = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!storeId) return;

    const handlePayload = ({ payload }: { payload: unknown }) => {
      const p = payload as InventoryUpdatePayload;
      if (!p?.itemId) return;
      // PLP rows carry `isInStock` — invalidate lists so the badge re-renders.
      // We can't target a single product detail entry without an
      // `itemId → productId` mapping; defer that to per-screen subscribers.
      qc.invalidateQueries({ queryKey: productQueryKeys.lists() });
    };

    const base = supabase.channel(`store:${storeId}:inventory`);
    for (const evt of INVENTORY_EVENTS) {
      base.on('broadcast', { event: evt }, handlePayload);
    }
    const ch = base.subscribe();

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
