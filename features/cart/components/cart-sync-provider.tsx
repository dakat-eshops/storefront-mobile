import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, type PropsWithChildren } from 'react';
import { cartQueryKeys } from '../collections/queryKeys';
import { readCart } from '../collections/storage';

/**
 * Guest ↔ authed cart sync stub.
 *
 * Per docs/_initial/05-data-layer.md the flow is:
 *   1. Listen to Clerk `isSignedIn` transitions.
 *   2. On `false → true`: read MMKV cart, POST `/cart/sync`, clear MMKV on
 *      success, invalidate `cartQueryKeys.all`.
 *
 * The `/fo-mobile/cart/sync` endpoint does NOT exist yet in `apps/api/`
 * (no `FoCartModule`). Until it ships, this provider just invalidates the
 * cart query on sign-in so any consumers re-read MMKV with the new auth
 * context. The MMKV cart is preserved across sign-in so nothing is lost.
 *
 * When the server endpoint lands, restore the POST + clear flow from this
 * file's git history.
 */
export function CartSyncProvider({ children }: PropsWithChildren) {
  const { isSignedIn } = useAuth();
  const qc = useQueryClient();
  const previousSignedIn = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    const prev = previousSignedIn.current;
    previousSignedIn.current = isSignedIn;

    if (prev === false && isSignedIn === true) {
      const items = readCart();
      if (items.length > 0) {
        // TODO(cart-sync): POST /fo-mobile/cart/sync once the endpoint exists.
        qc.invalidateQueries({ queryKey: cartQueryKeys.all });
      }
    }
  }, [isSignedIn, qc]);

  return <>{children}</>;
}
