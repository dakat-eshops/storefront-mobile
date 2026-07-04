import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { productQueryKeys } from '@/features/products/collections/queryKeys';
import { supabase } from '../supabase';
import { useAppActiveGate } from './use-app-active';

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
  // Connection budget: subscribe only while foregrounded — the gate tears the
  // channel down shortly after backgrounding and re-runs this effect on resume.
  const appActive = useAppActiveGate();
  // True once we have subscribed at least once → a later effect run is a
  // REJOIN (events were missed while torn down) and must reconcile.
  const hadSubscribedRef = useRef(false);

  useEffect(() => {
    if (!(storeId && appActive)) return;

    if (hadSubscribedRef.current) {
      // Broadcast is best-effort: anything emitted while backgrounded is gone.
      qc.invalidateQueries({ queryKey: productQueryKeys.lists() });
    }

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
    hadSubscribedRef.current = true;

    return () => {
      supabase.removeChannel(ch);
    };
  }, [storeId, appActive, qc]);
}
