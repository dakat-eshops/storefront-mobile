import { useAuth } from '@clerk/clerk-expo';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useApiClient } from '@/libs/api-client';
import { orderQueryKeys } from '../collections/queryKeys';
import type { OrderListResponse } from '../types';

const PAGE_SIZE = 10;

/**
 * Read-only order history. Requires Clerk JWT — the BO stub returns 403 for
 * anonymous callers (and the real service will do the same once it lands).
 *
 * The BO `/fo-mobile/.../orders` controller is currently a stub that returns
 * an empty list with `success: true`. Once `FoOrdersService` ships this hook
 * does NOT need to change.
 */
export function useOrders() {
  const api = useApiClient();
  const { isSignedIn } = useAuth();

  return useInfiniteQuery({
    queryKey: orderQueryKeys.lists(),
    queryFn: ({ pageParam = 0 }) =>
      api.get<OrderListResponse>(
        `/orders?limit=${PAGE_SIZE}&offset=${pageParam}`,
      ),
    getNextPageParam: (last, all) => {
      if (last.nextOffset != null) return last.nextOffset;
      if (last.items.length < PAGE_SIZE) return undefined;
      return all.length * PAGE_SIZE;
    },
    initialPageParam: 0,
    enabled: !!isSignedIn,
  });
}
