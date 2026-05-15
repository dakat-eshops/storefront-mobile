# 01 · Wishlist Collection Pattern

The wishlist follows the same dual-source TanStack DB collection pattern as the cart, but is simpler because wishlist items are single-field rows with no quantity or price.

## Row type

```ts
interface WishlistItem {
  productId: string;
}
```

That's it. No variant, no qty, no price.

## Collection factory

```ts
// features/wishlist/collections/wishlist-collection.ts
import { createCollection, localStorageCollectionOptions, queryCollectionOptions } from '@tanstack/db';
import { useQueryClient } from '@tanstack/react-query';

const GUEST_STORAGE_KEY = 'kuden-wishlist-items';

function createGuestWishlistCollection() {
  return createCollection(
    localStorageCollectionOptions<WishlistItem>({
      id: 'wishlist-guest',
      storageKey: GUEST_STORAGE_KEY,
      getKey: (item) => item.productId,
    }),
  );
}

function createAuthedWishlistCollection(queryClient: QueryClient, api: ReturnType<typeof useApiClient>) {
  return createCollection(
    queryCollectionOptions<WishlistItem>({
      id: 'wishlist-authed',
      queryKey: wishlistQueryKeys.all(),
      queryFn: () =>
        api.get<WishlistItem[]>(`/me/wishlist`),
      queryClient,
      getKey: (item) => item.productId,
      onInsert: async ({ transaction }) => {
        const { productId } = transaction.mutations[0].modified;
        await api.post(`/me/wishlist`, { productId });
      },
      onDelete: async ({ transaction }) => {
        const { productId } = transaction.mutations[0].original;
        await api.delete(`/me/wishlist/${productId}`);
      },
      // No onUpdate — wishlist items are binary (present / absent)
    }),
  );
}

export function useWishlistCollection() {
  const { isSignedIn } = useUser();
  const queryClient = useQueryClient();
  const api = useApiClient();

  return useMemo(
    () => (isSignedIn ? createAuthedWishlistCollection(queryClient, api) : createGuestWishlistCollection()),
    [isSignedIn, queryClient, api],
  );
}
```

## Toggle hook (public API)

```ts
// features/wishlist/hooks/use-wishlist.ts
export function useWishlist() {
  const collection = useWishlistCollection();
  const { data: items } = useLiveQuery(
    (q) => q.from({ item: collection }),
    [collection],
  );

  const isWishlisted = useCallback(
    (productId: string) => items?.some((i) => i.productId === productId) ?? false,
    [items],
  );

  const toggle = useCallback(
    (productId: string) => {
      if (isWishlisted(productId)) {
        collection.delete(productId);
      } else {
        collection.insert({ productId });
      }
    },
    [collection, isWishlisted],
  );

  return { items: items ?? [], isWishlisted, toggle };
}
```

## Wishlist button component

```tsx
// features/wishlist/components/wishlist-button.tsx
export function WishlistButton({ productId }: { productId: string }) {
  const { isWishlisted, toggle } = useWishlist();
  const active = isWishlisted(productId);

  return (
    <Pressable
      onPress={() => toggle(productId)}
      hitSlop={8}
      accessibilityLabel={active ? 'Remove from wishlist' : 'Add to wishlist'}
      accessibilityRole="button"
    >
      <HeartIcon
        size={24}
        filled={active}
        color={active ? colors.red[500] : colors.gray[400]}
      />
    </Pressable>
  );
}
```

## Guest → authed merge (WishlistSyncProvider)

On sign-in, read the guest MMKV collection and sync to the server:

```ts
// components/providers/wishlist-sync-provider.tsx
export function WishlistSyncProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useUser();
  const api = useApiClient();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    // Read guest items from MMKV directly (not via hook — collection ref is flipping)
    const stored = MMKV.getString(GUEST_STORAGE_KEY);
    if (!stored) return;

    const guestItems: WishlistItem[] = JSON.parse(stored);
    if (guestItems.length === 0) return;

    api
      .post(`/me/wishlist/sync`, {
        productIds: guestItems.map((i) => i.productId),
      })
      .then(() => {
        MMKV.delete(GUEST_STORAGE_KEY);
      })
      .catch(() => {
        // Guest items stay in MMKV; sync will retry next time
      });
  }, [isLoaded, isSignedIn, api]);

  return <>{children}</>;
}
```

Mount `WishlistSyncProvider` in the root `_layout.tsx` alongside `CartTanStackSyncProvider`.

## Wishlist screen

Show a grid of wishlisted products. Each product card has the `WishlistButton` in the corner for easy toggling. Fetch product details for each `productId` from the NestJS API.

If the collection is large (>100 items), paginate by slicing `items` in the live query:

```ts
const { data: page } = useLiveQuery(
  (q) =>
    q
      .from({ item: collection })
      .orderBy(({ item }) => item.productId, 'asc')
      .limit(GRID_PAGE_SIZE)
      .offset(currentPage * GRID_PAGE_SIZE),
  [collection, currentPage],
);
```
