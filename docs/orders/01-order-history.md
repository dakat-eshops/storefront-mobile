# 01 · Order History

## Screen overview

The order history screen shows a paginated, reverse-chronological list of the signed-in user's orders. It maps to `/orders` (tab) in the navigation.

## Data fetching

Use `useInfiniteQuery` for pagination — orders accumulate over time and a user with many orders needs lazy loading, not a fixed page:

```ts
// features/orders/hooks/use-orders.ts
import { useInfiniteQuery } from '@tanstack/react-query';
import { useApiClient } from '@/libs/api-client';
import { orderQueryKeys } from '../collections/queryKeys';

const PAGE_SIZE = 20;

export function useOrders() {
  const profileId = useProfileId();   // from Clerk
  const api = useApiClient();

  return useInfiniteQuery({
    queryKey: orderQueryKeys.list(profileId),
    queryFn: ({ pageParam = 0, signal }) =>
      api.get<OrderListResponse>(`/me/orders?limit=${PAGE_SIZE}&offset=${pageParam}`, signal),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.length * PAGE_SIZE;
      return loaded < lastPage.total ? loaded : undefined;
    },
    enabled: !!profileId,
    staleTime: 1000 * 60 * 2,   // 2 minutes — order status can change
  });
}
```

## FlatList with infinite scroll

```tsx
// features/orders/components/order-list.tsx
import { FlatList, RefreshControl } from 'react-native';

export function OrderList() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, isRefetching } = useOrders();

  const orders = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);

  return (
    <FlatList
      data={orders}
      keyExtractor={(order) => order.id}
      renderItem={({ item }) => <OrderCard order={item} />}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator /> : null}
      ListEmptyComponent={<EmptyOrders />}
    />
  );
}
```

## Order card

Each order card shows:

- Order number (e.g., `#0012`)
- Created date (`created_at`, formatted `dd/MM/yyyy`)
- Status badge (see status mapping below)
- Total amount (VND formatted)
- Thumbnail of the first item's product image
- Quick action: "Mua lại" (Re-order) button for completed orders

```tsx
<OrderCard
  orderId={order.id}
  orderNumber={order.number}
  createdAt={order.createdAt}
  status={order.status}
  total={order.total}
  firstItemImage={order.items[0]?.productImage}
  onPress={() => router.push(`/orders/${order.id}`)}
/>
```

## Order status mapping

| BO status | Display (Vietnamese) | Badge color |
| --- | --- | --- |
| `pending` | Chờ xác nhận | Yellow |
| `confirmed` | Đã xác nhận | Blue |
| `processing` | Đang chuẩn bị | Blue |
| `shipped` | Đang giao | Purple |
| `delivered` | Đã giao | Green |
| `cancelled` | Đã hủy | Gray |
| `return_requested` | Yêu cầu hoàn trả | Orange |
| `returned` | Đã hoàn trả | Gray |

## Pull-to-refresh

The `RefreshControl` above handles pull-to-refresh. The `refetch()` call invalidates and re-fetches the first page only (subsequent pages stay cached until the user scrolls). This is intentional — orders appear at the top of the list.

## Empty state

```tsx
function EmptyOrders() {
  return (
    <View style={styles.empty}>
      <OrderBoxIcon size={64} color={colors.muted} />
      <Text style={styles.emptyTitle}>Chưa có đơn hàng nào</Text>
      <Text style={styles.emptyBody}>Hãy mua sắm ngay để xem đơn hàng của bạn tại đây</Text>
      <Button onPress={() => router.push('/')}>Mua sắm ngay</Button>
    </View>
  );
}
```
