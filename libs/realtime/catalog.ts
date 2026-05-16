import type { RealtimeChannel } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { productQueryKeys } from '@/features/products/collections/queryKeys';
import { supabase } from '../supabase';

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
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!storeId) return;

    const handle = (p: CatalogPayload) => {
      if (p?.productId) {
        qc.invalidateQueries({ queryKey: productQueryKeys.detail(p.productId) });
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
