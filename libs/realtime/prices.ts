import type { RealtimeChannel } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { productQueryKeys } from '@/features/products/collections/queryKeys';
import { supabase } from '../supabase';

/**
 * `store:{storeId}:prices` / event `price_update`.
 *
 * Wire contract (BO is source of truth — see
 * `BO/e-Shops/apps/api/src/modules/admin/price-books/price-books.service.ts`):
 *
 *   { priceBookId: string;
 *     name: string;          // price-book name
 *     currency: string;
 *     effectiveAt: string }  // ISO-8601
 *
 * **BO does NOT emit `productId(s)` or `newPrice`** — the event signals
 * "a price book mutated", not "product X is now priced Y". Per-product
 * detail invalidation is impossible from this payload alone (we'd need an
 * `itemPriceBooks` lookup the mobile client doesn't cache).
 *
 * Mobile policy: invalidate the products list only — the affected products
 * will refetch their (now-stale) prices on next render. PDP screens that
 * need true real-time price reactivity should subscribe separately and
 * refetch on every event regardless of priceBookId.
 *
 * Audit history: prior version typed `payload as { productIds?: string[],
 * priceBookId? }` and looped over `p.productIds`. BO never emits that field,
 * so the per-product invalidation was dead code. Fixed 2026-05-16.
 */
type PriceUpdatePayload = {
  priceBookId: string;
  name: string;
  currency: string;
  effectiveAt: string;
};

export function usePricesBroadcast(storeId: string | undefined) {
  const qc = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!storeId) return;

    const ch = supabase
      .channel(`store:${storeId}:prices`)
      .on('broadcast', { event: 'price_update' }, ({ payload }) => {
        const p = payload as PriceUpdatePayload;
        if (!p?.priceBookId) return;
        // Cannot target individual products — BO doesn't tell us which.
        // Invalidating the lists triggers a refetch that surfaces new prices.
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
