import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { productQueryKeys } from '@/features/products/collections/queryKeys';
import { supabase } from '../supabase';
import { useAppActiveGate } from './use-app-active';

/**
 * `store:{storeId}:catalog` / events `product_published` + `product_unpublished`.
 *
 * Wire contract (BO is source of truth — see
 * `BO/e-Shops/apps/api/src/modules/admin/products/products.service.ts`):
 *
 *   { productId: string;
 *     slug: string;
 *     action: 'published' | 'unpublished' }
 *
 * Triggered by BO when `ProductsService.update` flips `isPublished`. The hook
 * only consumes `productId` today, but the full shape is typed so future
 * deep-linking (by slug) doesn't need a contract change.
 */
type CatalogPayload = {
  productId: string;
  slug: string;
  action: 'published' | 'unpublished';
};

export function useCatalogBroadcast(storeId: string | undefined) {
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
      // Broadcast is best-effort: publish/unpublish events emitted while
      // backgrounded are gone — refetch lists to reconcile.
      qc.invalidateQueries({ queryKey: productQueryKeys.lists() });
    }

    const handle = (p: CatalogPayload) => {
      if (p?.productId) {
        qc.invalidateQueries({
          queryKey: productQueryKeys.detail(p.productId),
        });
      }
      qc.invalidateQueries({ queryKey: productQueryKeys.lists() });
    };

    const ch = supabase
      .channel(`store:${storeId}:catalog`)
      .on('broadcast', { event: 'product_published' }, ({ payload }) =>
        handle(payload as CatalogPayload),
      )
      .on('broadcast', { event: 'product_unpublished' }, ({ payload }) =>
        handle(payload as CatalogPayload),
      )
      .subscribe();

    hadSubscribedRef.current = true;

    return () => {
      supabase.removeChannel(ch);
    };
  }, [storeId, appActive, qc]);
}
