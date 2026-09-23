import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cartQueryKeys } from '../collections/queryKeys';
import { clearCart, readCart, writeCart } from '../collections/storage';
import type { CartStorageItem } from '../types';

/**
 * MMKV is the source of truth for the cart on mobile today.
 *
 * The web FO stores guest carts in `localStorage` and syncs to a NestJS
 * `/cart/*` API on sign-in. Those `/cart/*` endpoints are NOT yet wired in
 * `apps/api/` (no `FoCartModule` exists). Until they ship, mobile cart
 * mutations stay 100% local for both guest and authed users — there is no
 * "/fo-mobile/cart" endpoint to call without 404-ing.
 *
 * When the server cart endpoints land:
 *   1. Switch `useCart` to fetch `/cart` when signed in.
 *   2. Switch the mutations to call `/cart/items` (etc.) and remove the local
 *      MMKV writes for authed users.
 *   3. `CartSyncProvider` will then have a real `/cart/sync` endpoint to hit.
 *
 * Until then, signing in does NOT lose the cart — the same MMKV store is
 * shared across guest + authed states.
 *
 * See docs/_initial/05-data-layer.md.
 */
export function useCart() {
  return useQuery({
    queryKey: cartQueryKeys.detail('guest'),
    queryFn: async () => readCart(),
    staleTime: 0,
  });
}

function upsertLocal(item: CartStorageItem): CartStorageItem[] {
  const current = readCart();
  const idx = current.findIndex((i) => i.itemId === item.itemId);
  if (idx >= 0) {
    const merged = { ...current[idx], qty: current[idx].qty + item.qty };
    const next = [...current];
    next[idx] = merged;
    writeCart(next);
    return next;
  }
  const next = [...current, { ...item, addedAt: new Date().toISOString() }];
  writeCart(next);
  return next;
}

export function useAddToCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: CartStorageItem) => upsertLocal(item),
    onSuccess: (next) => {
      qc.setQueryData(cartQueryKeys.detail('guest'), next);
    },
  });
}

export function useUpdateCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { itemId: string; qty: number }) => {
      const current = readCart();
      const next =
        input.qty <= 0
          ? current.filter((i) => i.itemId !== input.itemId)
          : current.map((i) =>
              i.itemId === input.itemId ? { ...i, qty: input.qty } : i,
            );
      writeCart(next);
      return next;
    },
    onSuccess: (next) => {
      qc.setQueryData(cartQueryKeys.detail('guest'), next);
    },
  });
}

export function useRemoveCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const next = readCart().filter((i) => i.itemId !== itemId);
      writeCart(next);
      return next;
    },
    onSuccess: (next) => qc.setQueryData(cartQueryKeys.detail('guest'), next),
  });
}

export function useClearCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      clearCart();
      return [] as CartStorageItem[];
    },
    onSuccess: () => qc.setQueryData(cartQueryKeys.detail('guest'), []),
  });
}
