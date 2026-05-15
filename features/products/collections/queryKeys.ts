/**
 * Single source of truth for product query keys. Same shape as the FO web
 * `productQueryKeys` so a future shared `@khanhstore/data` package lands
 * cleanly (per docs/_initial/05-data-layer.md).
 *
 * ALWAYS import keys from here. Never hardcode `['products', ...]` inline.
 */
export type ProductListParams = {
  catalogSlug?: string;
  categorySlug?: string;
  categoryId?: string;
  q?: string;
  isFeatured?: boolean;
};

export const productQueryKeys = {
  all: ['products'] as const,
  lists: () => [...productQueryKeys.all, 'list'] as const,
  list: (params: ProductListParams) =>
    [...productQueryKeys.lists(), params] as const,
  details: () => [...productQueryKeys.all, 'detail'] as const,
  detail: (slugOrId: string) =>
    [...productQueryKeys.details(), slugOrId] as const,
};
