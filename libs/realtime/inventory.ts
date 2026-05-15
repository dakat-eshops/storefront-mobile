import { useEffect } from 'react';
import { AppState } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

/**
 * Subscribe to inventory broadcast for a store and reconcile on AppState
 * `active` (mobile sleeps the WebSocket on background).
 *
 * Channel: store:{storeId}:inventory
 * Event:   inventory_update
 *
 * See FO/KhanhStore/docs/react_native/06-realtime.md and the FO web mirror
 * at FO/KhanhStore/src/libs/realtime/useInventoryRealtime.ts.
 */
export function useInventoryBroadcast(storeId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!storeId) return;

    let channel: RealtimeChannel | null = supabase
      .channel(`store:${storeId}:inventory`)
      .on('broadcast', { event: 'inventory_update' }, (payload) => {
        // TODO: targeted patch via patchProductInventory once product
        // collections exist. For now: invalidate the affected product query.
        const productId = (payload.payload as { productId?: string } | undefined)?.productId;
        if (productId) {
          queryClient.invalidateQueries({ queryKey: ['products', 'detail', { id: productId }] });
        } else {
          queryClient.invalidateQueries({ queryKey: ['products'] });
        }
      })
      .subscribe();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        // Reconnect + reconcile after backgrounding.
        queryClient.invalidateQueries({ queryKey: ['products'] });
      }
    });

    return () => {
      sub.remove();
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };
  }, [storeId, queryClient]);
}
