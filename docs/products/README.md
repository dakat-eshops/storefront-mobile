# Products — Mobile FO

Product list (PLP) + product detail (PDP) surfaces. Mirrors web FO
`src/features/product/` in shape, adapted to RN.

**Data source**: NestJS `/2026-01/fo-mobile/stores/{storeId}/products` via
`useApiClient()` — plain TanStack Query (no TanStack DB collections on RN).

## Code map

| File | Purpose |
| --- | --- |
| [features/products/collections/queryKeys.ts](../../features/products/collections/queryKeys.ts) | Query keys — never hardcode `['products', ...]` inline |
| [features/products/hooks/use-products.ts](../../features/products/hooks/use-products.ts) | `useProducts` (PLP/search) + `useProductDetail` (PDP) |
| [features/products/components/product-card.tsx](../../features/products/components/product-card.tsx) | PLP card |
| [features/products/components/product-barcode.tsx](../../features/products/components/product-barcode.tsx) | Barcode render (see [../barcode/](../barcode/README.md)) |
| [features/products/utils/format-price.ts](../../features/products/utils/format-price.ts) | VND price formatting |
| [features/products/types.ts](../../features/products/types.ts) | Response types (derived from NestJS FO contract) |

## Related docs

- [../broadcast/](../broadcast/README.md) — inventory / prices / catalog Broadcast subscribers that invalidate product queries
- [../qr-code/](../qr-code/README.md) + [../barcode/](../barcode/README.md) — scan/display surfaces that resolve to products
- [../_initial/05-data-layer.md](../_initial/05-data-layer.md) — query/caching conventions
