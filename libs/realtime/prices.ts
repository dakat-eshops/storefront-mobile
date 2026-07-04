import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { productQueryKeys } from '@/features/products/collections/queryKeys';
import { supabase } from '../supabase';
import { useAppActiveGate } from './use-app-active';

/**
 * `store:{storeId}:prices` / event `price_update`.
 *
 * Wire contract (BO is source of truth — see
 * `BO/e-Shops/apps/api/src/modules/admin/price-books/price-books.service.ts`
 * → `broadcastPriceIfEnabled` and `BROADCAST_FANOUT_GUIDE §5`):
 *
 *   { priceBookId: string;
 *     name: string;                  // price-book name
 *     currency: string;
 *     effectiveAt: string;           // ISO-8601
 *     affectedProductIds: string[];  // products whose item_price_books row changed
 *     affectedVariationIds: string[] // variations whose row changed
 *   }
 *
 * The payload does NOT carry the new price value — BO enumerates the affected
 * IDs, not prices. Mobile must refetch to surface the new price. Both arrays
 * are empty when only book metadata changed (name/currency/dates) — in that
 * case nothing customer-facing changed, so we skip cache work entirely.
 *
 * Mobile policy:
 *   - Invalidate the products list so PLP/homepage tiles refetch fresh prices.
 *   - Surgically invalidate each affected product's detail query (best-effort:
 *     PDP detail is keyed by slug-or-id, so a UUID hit only lands on PDPs keyed
 *     by id; the list invalidation is the reliable path). Variation-level
 *     changes fall back to the list refetch (mobile caches no variation→product
 *     map).
 *
 * Audit history: the 2026-05-16 version dropped per-product handling because BO
 * did not emit product ids at that time. BO has since added
 * `affectedProductIds` + `affectedVariationIds` (the FO web `usePricesRealtime`
 * already consumes them), so this hook now honours them — and stops blindly
 * invalidating on metadata-only book edits.
 */
type PriceUpdatePayload = {
  priceBookId: string;
  name: string;
  currency: string;
  effectiveAt: string;
  affectedProductIds: string[];
  affectedVariationIds: string[];
};

export function usePricesBroadcast(storeId: string | undefined) {
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
      // Broadcast is best-effort: price updates emitted while backgrounded are
      // gone, and we don't know which products they touched — refetch lists.
      qc.invalidateQueries({ queryKey: productQueryKeys.lists() });
    }

    const ch = supabase
      .channel(`store:${storeId}:prices`)
      .on('broadcast', { event: 'price_update' }, ({ payload }) => {
        const p = payload as PriceUpdatePayload;
        if (!p?.priceBookId) return;

        const productIds = p.affectedProductIds ?? [];
        const variationIds = p.affectedVariationIds ?? [];
        // Metadata-only book change (name/currency/dates) → no product prices
        // moved → nothing to refetch.
        if (productIds.length === 0 && variationIds.length === 0) return;

        // Reliable path: lists refetch so PLP/homepage tiles surface new prices.
        qc.invalidateQueries({ queryKey: productQueryKeys.lists() });
        // Best-effort surgical: bust each affected product's detail query.
        for (const productId of productIds) {
          qc.invalidateQueries({
            queryKey: productQueryKeys.detail(productId),
          });
        }
      })
      .subscribe();

    hadSubscribedRef.current = true;

    return () => {
      supabase.removeChannel(ch);
    };
  }, [storeId, appActive, qc]);
}
