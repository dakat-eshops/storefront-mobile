# 05 · Data Layer

Same shape as web FO: **TanStack Query for reads, TanStack DB for cart/wishlist, mutations via `useMutation` → server.** What changes on mobile is the storage driver, the network resilience requirements, and the absence of Next.js `'use cache'`.

## TanStack Query setup with MMKV persistence

```ts
// libs/query-client.ts
import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { MMKV } from 'react-native-mmkv';
import { ApiError } from '@/libs/api-client';

const storage = new MMKV({ id: 'khanhstore-query-cache' });

const mmkvStorage = {
  setItem: (k: string, v: string) => Promise.resolve(storage.set(k, v)),
  getItem: (k: string) => Promise.resolve(storage.getString(k) ?? null),
  removeItem: (k: string) => Promise.resolve(storage.delete(k)),
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,        // 5min — mobile users idle longer between sessions
      gcTime: 1000 * 60 * 60 * 24,     // 24h on-disk
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 3;
      },
      networkMode: 'offlineFirst',     // serve cache when offline
    },
    mutations: {
      networkMode: 'offlineFirst',
      retry: 0,                        // mutations should NOT auto-retry — surface error to user
    },
  },
});

export const persister = createAsyncStoragePersister({
  storage: mmkvStorage,
  key: 'khanhstore-query-cache-v1',     // bump suffix on breaking cache shape changes
});
```

Wrap the app root with **`PersistQueryClientProvider` only** — it already provides the `QueryClientProvider` context internally, so wrapping both causes a duplicate provider warning and double-persists every cache entry:

```tsx
// app/_layout.tsx
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, persister } from '@/libs/query-client';

<PersistQueryClientProvider
  client={queryClient}
  persistOptions={{
    persister,
    maxAge: 1000 * 60 * 60 * 24 * 7,                  // 7 days
    buster: process.env.EXPO_PUBLIC_APP_VERSION,      // invalidate cache on app upgrade
  }}
>
  {/* ... */}
</PersistQueryClientProvider>
```

## Query keys — same source-of-truth rule as web

Per `CLAUDE.md`: **all `queryKey` values MUST use keys defined in `features/[entity]/collections/queryKeys.ts`. Never hardcode inline arrays.** Same rule on mobile, same files, identical key shape — this lets a future shared `@khanhstore/data` package land cleanly.

```ts
// features/products/collections/queryKeys.ts
export const productQueryKeys = {
  all: ['products'] as const,
  lists: () => [...productQueryKeys.all, 'list'] as const,
  list: (params: { catalogSlug?: string; categorySlug?: string; q?: string }) =>
    [...productQueryKeys.lists(), params] as const,
  details: () => [...productQueryKeys.all, 'detail'] as const,
  detail: (slugOrId: string) => [...productQueryKeys.details(), slugOrId] as const,
};
```

## Hooks pattern

```ts
// features/products/hooks/use-products.ts
import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/libs/api-client';
import { productQueryKeys } from '../collections/queryKeys';
import type { Product } from '@eshops/db/types';

export function useProductList(params: { catalogSlug?: string }) {
  const api = useApiClient();
  return useQuery({
    queryKey: productQueryKeys.list(params),
    queryFn: ({ signal }) => api.get<{ items: Product[]; total: number }>(
      `/products?catalogSlug=${params.catalogSlug ?? ''}`,
      signal,
    ),
  });
}
```

## Mutations — same `useMutation` pattern as web

```ts
// features/cart/hooks/use-update-cart-item.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/libs/api-client';
import { cartQueryKeys } from '../collections/queryKeys';

export function useUpdateCartItem() {
  const api = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { itemId: string; qty: number }) =>
      api.patch<CartItem>(`/cart/items/${input.itemId}`, { qty: input.qty }),
    onSuccess: () => qc.invalidateQueries({ queryKey: cartQueryKeys.all }),
  });
}
```

NestJS owns audit, cache revalidation, and Broadcast emission server-side — the mobile mutation is a thin wrapper, same as web server actions are thin wrappers. The mobile app does not call `revalidate*Cache` (those are Next.js-only) and does not need to — the cache that matters here is the on-device TanStack Query cache, invalidated by `queryClient.invalidateQueries`.

## Cart and wishlist — TanStack DB on mobile

The web FO uses TanStack DB with `localStorageCollectionOptions` (guest) and `queryCollectionOptions` (authed). On mobile, replace `localStorageCollectionOptions` with an **MMKV-backed collection** so the collection still feels synchronous and so the guest cart survives app restarts.

```ts
// features/cart/collections/cart.ts
import { createCollection, localStorageCollectionOptions } from '@tanstack/db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { MMKV } from 'react-native-mmkv';
import { queryClient } from '@/libs/query-client';
import { cartQueryKeys } from './queryKeys';
// CartStorageItem is the shared type from @eshops/db-types (types-only import).
// Its primary key field is `itemId`, not `id`.
import type { CartStorageItem } from '@eshops/db/types';

const storage = new MMKV({ id: 'khanhstore-cart' });

// MMKV-backed shim that satisfies the `StorageApi` subset that
// `localStorageCollectionOptions` actually uses (getItem/setItem/removeItem).
// MMKV is synchronous, which is what this driver requires.
const mmkvStorage = {
  getItem: (k: string) => storage.getString(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
};

// `localStorageCollectionOptions` ALSO defaults `storageEventApi` to `window`
// for cross-tab sync. `window` does not exist on RN, so we pass a no-op —
// there are no other tabs on a native app.
const noopStorageEventApi = {
  addEventListener: () => {},
  removeEventListener: () => {},
};

export function createGuestCartCollection() {
  return createCollection(
    localStorageCollectionOptions<CartStorageItem>({
      id: 'cart-items-guest',             // matches web FO collection id
      storageKey: 'kuden-cart-items',     // MUST match web FO (CART_LOCAL_STORAGE_KEY)
      storage: mmkvStorage,               // swap browser localStorage for MMKV
      storageEventApi: noopStorageEventApi, // REQUIRED on RN — default `window` crashes
      getKey: (item) => item.itemId,      // CartStorageItem key is itemId, not id
    }),
  );
}

export function createAuthedCartCollection(api: ReturnType<typeof useApiClient>) {
  return createCollection(
    queryCollectionOptions({
      id: 'cart-items-authed',            // matches web FO collection id prefix
      queryKey: cartQueryKeys.detail('me'),
      queryFn: () => api.get<CartStorageItem[]>('/cart'),
      queryClient,
      getKey: (item) => item.itemId,      // CartStorageItem key is itemId, not id
      onInsert: async ({ transaction }) => {
        for (const m of transaction.mutations) await api.post('/cart/items', m.modified);
      },
      onUpdate: async ({ transaction }) => {
        for (const m of transaction.mutations) await api.patch(`/cart/items/${m.original.id}`, m.changes);
      },
      onDelete: async ({ transaction }) => {
        for (const m of transaction.mutations) await api.delete(`/cart/items/${m.original.id}`);
      },
    }),
  );
}
```

The provider that swaps guest ↔ authed on sign-in is structurally identical to `CartTanStackSyncProvider` on web:

1. Listen to Clerk `isSignedIn` transitions.
2. On `false → true`: read MMKV cart, POST to `/cart/sync`, clear MMKV on success, invalidate `cartQueryKeys.all`.
3. Retry up to 5 × 3s for `publicMetadata.profileId` to populate (Clerk webhook race).

Same rules, different storage driver.

## Offline behavior

| Surface | Offline behavior |
| --- | --- |
| Product list / detail | Serve last cached response (`networkMode: 'offlineFirst'`). Show a stale banner if `dataUpdatedAt > 1h`. |
| Cart (guest or authed) | Always works — MMKV-backed. Sync queues on reconnect. |
| Wishlist | Same as cart. |
| Checkout | **Block.** Show "You're offline — try again when connected." Checkout requires fresh inventory + price + tax computation. |
| Order history | Last cache only. No retry, no spinner. |
| Sign-in | Block with clear messaging. |

Use `@react-native-community/netinfo` (Expo bundles it) to detect connectivity and gate the checkout button.

## Return type contract

All mobile gateway responses follow the same `ApiResponse<T>` envelope as web/BO:

```ts
type ApiResponse<T> = { success: true; data: T } | { success: false; error: string };
```

The API client unwraps `.data` and throws on `.success === false`. Mutations and queries receive `T` directly, never the envelope.

## Pagination

Same rule: **default limit `10`** unless overridden. Mobile lists use infinite scroll via `useInfiniteQuery`:

```ts
useInfiniteQuery({
  queryKey: productQueryKeys.list({ catalogSlug }),
  queryFn: ({ pageParam = 0, signal }) =>
    api.get<{ items: Product[]; nextOffset: number | null }>(
      `/products?catalogSlug=${catalogSlug}&limit=10&offset=${pageParam}`,
      signal,
    ),
  getNextPageParam: (last) => last.nextOffset,
  initialPageParam: 0,
});
```

## Error handling

Mirrors web FO. Use the project's error logger (port `@/libs/Logger` to a RN-safe variant — pino does not run in RN; use `expo-logger` or a thin wrapper that ships to Sentry). On `ApiError`:

- `401` → sign user out, route to `/sign-in`
- `403` → toast "Not authorized"
- `429` → exponential backoff + toast "Slow down"
- `5xx` → toast "Server error, please try again" + report to Sentry

Never bubble raw error strings from NestJS into the UI — strip server-side stack details, surface only the `error` field of `ApiResponse`.

## What you DO NOT use on mobile

| Web pattern | Mobile equivalent |
| --- | --- |
| `'use cache'` + Next.js cache life presets | MMKV persister + `staleTime` / `gcTime` |
| `tagEntityCache` / `revalidateEntityCache` | `queryClient.invalidateQueries` |
| `HydrationBoundary` + `dehydrate` (server prefetch) | None — mobile renders client-side; persisted cache handles cold start |
| `next/image` + `@unpic/react` | `expo-image` |
| `'use server'` actions | `useMutation` calling the mobile gateway |
| `serverApi` / `nestjsApiClient` | `useApiClient()` |
