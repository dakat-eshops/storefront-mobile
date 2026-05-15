# Products feature

Per docs/. Mirrors web FO `src/features/product/`:

- `collections/` — TanStack Query keys + DB collections
- `hooks/` — `useProducts`, `useProductDetail`
- `components/` — RN components

Data source: NestJS `/<version>/fo-mobile/stores/<storeId>/products` via `useApiClient()`.
