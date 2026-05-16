import { useAuth } from '@clerk/clerk-expo';
import { useEffect, type PropsWithChildren } from 'react';
import { env } from '../env';
import { supabase } from '../supabase';
import { useCatalogBroadcast } from './catalog';
import { useInventoryBroadcast } from './inventory';
import { usePricesBroadcast } from './prices';

/**
 * Mounts all FO mobile Broadcast subscribers (inventory + prices + catalog)
 * for the default store. Doc §06-realtime: subscribe at app start — one
 * WebSocket multiplexes all topics.
 *
 * Tears down every channel on sign-out so the next user does not inherit the
 * previous Clerk-scoped session.
 */
export function RealtimeProvider({ children }: PropsWithChildren) {
  const storeId = env.defaultStoreId;
  useInventoryBroadcast(storeId);
  usePricesBroadcast(storeId);
  useCatalogBroadcast(storeId);

  const { isSignedIn } = useAuth();
  useEffect(() => {
    return () => {
      // On unmount only; harmless to call repeatedly.
      supabase.removeAllChannels();
    };
  }, []);

  useEffect(() => {
    // Sign-out edge — drop all channels so re-subscribe happens fresh.
    if (isSignedIn === false) {
      supabase.removeAllChannels();
    }
  }, [isSignedIn]);

  return <>{children}</>;
}
