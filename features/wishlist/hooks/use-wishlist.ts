import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { wishlistQueryKeys } from '../collections/queryKeys';
import { readWishlist, writeWishlist } from '../collections/storage';
import type { WishlistItem } from '../types';

export function useWishlist() {
  return useQuery({
    queryKey: wishlistQueryKeys.detail(),
    queryFn: async () => readWishlist(),
    staleTime: 0,
  });
}

export function useIsWishlisted(productId: string | undefined) {
  const { data } = useWishlist();
  return !!productId && !!data?.some((i) => i.productId === productId);
}

export function useToggleWishlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Omit<WishlistItem, 'addedAt'>) => {
      const current = readWishlist();
      const idx = current.findIndex((i) => i.productId === item.productId);
      const next =
        idx >= 0
          ? current.filter((i) => i.productId !== item.productId)
          : [...current, { ...item, addedAt: new Date().toISOString() }];
      writeWishlist(next);
      return next;
    },
    onSuccess: (next) => qc.setQueryData(wishlistQueryKeys.detail(), next),
  });
}

export function useRemoveFromWishlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (productId: string) => {
      const next = readWishlist().filter((i) => i.productId !== productId);
      writeWishlist(next);
      return next;
    },
    onSuccess: (next) => qc.setQueryData(wishlistQueryKeys.detail(), next),
  });
}
