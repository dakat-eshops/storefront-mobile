import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, type PropsWithChildren } from 'react';
import { useApiClient } from '@/libs/api-client';
import { cartQueryKeys } from '../collections/queryKeys';
import { clearCart, readCart } from '../collections/storage';

/**
 * Sync the MMKV guest cart up to the server on Clerk sign-in. Mirrors the
 * web FO `CartTanStackSyncProvider` flow (docs/_initial/05-data-layer.md):
 *
 *   1. Listen to Clerk `isSignedIn` transitions.
 *   2. On `false → true`: read MMKV cart, POST `/cart/sync`, clear MMKV on
 *      success, invalidate cartQueryKeys.all.
 *
 * Failure mode: if the server rejects, MMKV is preserved so the guest cart is
 * not lost. The next launch will retry on the next sign-in transition.
 */
export function CartSyncProvider({ children }: PropsWithChildren) {
  const { isSignedIn } = useAuth();
  const api = useApiClient();
  const qc = useQueryClient();
  const previousSignedIn = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    const prev = previousSignedIn.current;
    previousSignedIn.current = isSignedIn;

    if (prev === false && isSignedIn === true) {
      const items = readCart();
      if (items.length === 0) return;

      void (async () => {
        try {
          await api.post('/cart/sync', { items });
          clearCart();
          qc.invalidateQueries({ queryKey: cartQueryKeys.all });
        } catch {
          // Leave MMKV intact; retry on next sign-in.
        }
      })();
    }
  }, [isSignedIn, api, qc]);

  return <>{children}</>;
}
