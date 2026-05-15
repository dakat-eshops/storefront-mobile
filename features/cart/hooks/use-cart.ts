import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { useApiClient } from '@/libs/api-client';
import { cartQueryKeys } from '../collections/queryKeys';
import { clearCart, readCart, writeCart } from '../collections/storage';
import type { CartStorageItem } from '../types';

/**
 * Guest cart (MMKV) and authed cart (NestJS) share one read hook. When the
 * user is signed in, reads + writes proxy to `/fo-mobile/.../cart`. When
 * signed out, MMKV is the source of truth.
 *
 * Sync on sign-in (POST /cart/sync) is handled by `CartSyncProvider`.
 */
export function useCart() {
  const api = useApiClient();
  const { isSignedIn } = useAuth();

  return useQuery({
    queryKey: cartQueryKeys.detail(isSignedIn ? 'me' : 'guest'),
    queryFn: async () => {
      if (isSignedIn) return api.get<CartStorageItem[]>('/cart');
      return readCart();
    },
    // MMKV reads are sync; no need to retry.
    retry: isSignedIn ? 2 : 0,
    staleTime: isSignedIn ? 1000 * 60 * 5 : 0,
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
  const api = useApiClient();
  const qc = useQueryClient();
  const { isSignedIn } = useAuth();

  return useMutation({
    mutationFn: async (item: CartStorageItem) => {
      if (isSignedIn) {
        await api.post('/cart/items', item);
        return null;
      }
      return upsertLocal(item);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cartQueryKeys.all });
    },
  });
}

export function useUpdateCartItem() {
  const api = useApiClient();
  const qc = useQueryClient();
  const { isSignedIn } = useAuth();

  return useMutation({
    mutationFn: async (input: { itemId: string; qty: number }) => {
      if (isSignedIn) {
        await api.patch(`/cart/items/${input.itemId}`, { qty: input.qty });
        return null;
      }
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
    onSuccess: () => qc.invalidateQueries({ queryKey: cartQueryKeys.all }),
  });
}

export function useRemoveCartItem() {
  const api = useApiClient();
  const qc = useQueryClient();
  const { isSignedIn } = useAuth();

  return useMutation({
    mutationFn: async (itemId: string) => {
      if (isSignedIn) {
        await api.delete(`/cart/items/${itemId}`);
        return null;
      }
      const next = readCart().filter((i) => i.itemId !== itemId);
      writeCart(next);
      return next;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: cartQueryKeys.all }),
  });
}

export function useClearCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      clearCart();
      return [];
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: cartQueryKeys.all }),
  });
}
