import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/libs/api-client';
import {
  productQueryKeys,
  type ProductListParams,
} from '../collections/queryKeys';
import type { Paginated, ProductDetail, ProductListItem } from '../types';

const PAGE_SIZE = 10;

function buildQuery(params: ProductListParams & { limit: number; offset: number }) {
  const usp = new URLSearchParams();
  if (params.q) usp.set('productName', params.q);
  if (params.categoryId) usp.set('categoryId', params.categoryId);
  if (params.isFeatured !== undefined)
    usp.set('isFeatured', String(params.isFeatured));
  usp.set('limit', String(params.limit));
  usp.set('offset', String(params.offset));
  return usp.toString();
}

/**
 * Paginated PLP fetch via infinite scroll.
 * Mirrors the FO web `useProductList` hook surface.
 */
export function useProductList(params: ProductListParams = {}) {
  const api = useApiClient();
  return useInfiniteQuery({
    queryKey: productQueryKeys.list(params),
    queryFn: ({ pageParam = 0 }) =>
      api.get<Paginated<ProductListItem>>(
        `/products?${buildQuery({ ...params, limit: PAGE_SIZE, offset: pageParam })}`,
      ),
    getNextPageParam: (last, all) => {
      if (last.nextOffset != null) return last.nextOffset;
      // Fallback: if backend returns a flat page with no nextOffset, assume
      // we've reached the end when a page is short of PAGE_SIZE.
      if (last.items.length < PAGE_SIZE) return undefined;
      return all.length * PAGE_SIZE;
    },
    initialPageParam: 0,
  });
}

/**
 * Single-product detail fetch for PDP.
 * `slugOrId` may be a UUID or a slug — NestJS `FoProductsDbService.findOne`
 * resolves either.
 */
export function useProductDetail(slugOrId: string | undefined) {
  const api = useApiClient();
  return useQuery({
    queryKey: productQueryKeys.detail(slugOrId ?? ''),
    queryFn: () => api.get<ProductDetail>(`/products/${slugOrId}`),
    enabled: !!slugOrId,
  });
}
