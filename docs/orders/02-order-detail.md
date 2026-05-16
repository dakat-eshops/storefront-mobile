# 02 · Order Detail

## Screen overview

The order detail screen shows full information for a single order. It is also the "thank you" screen after a successful checkout. Accessible from:

- Order history list (tap on an order card)
- Push notification deep link: `khanhstore://orders/:orderId`
- Checkout success redirect: `router.replace('/orders/:orderId')`

## Data fetching

```ts
// features/orders/hooks/use-order.ts
import { useApiClient } from '@/libs/api-client';

export function useOrder(orderId: string) {
  const api = useApiClient();

  return useQuery({
    queryKey: orderQueryKeys.detail(orderId),
    queryFn: ({ signal }) =>
      api.get<Order>(`/me/orders/${orderId}`, signal),
    enabled: !!orderId,
    staleTime: 1000 * 60,   // 1 minute — status may change
  });
}
```

## Screen sections

1. **Order status header** — large status badge + message (`"Đơn hàng của bạn đang được giao"`)
2. **Progress timeline** — vertical step indicator for order lifecycle (pending → confirmed → processing → shipped → delivered)
3. **Items** — product list with images, variant, qty, unit price
4. **Shipping info** — recipient name, phone, address, estimated delivery
5. **Payment info** — method, amount paid / COD amount
6. **Price breakdown** — subtotal, discount, shipping fee, total
7. **Actions** — context-sensitive (see below)

## Context-sensitive action buttons

| Order status | Actions available |
| --- | --- |
| `pending` | "Hủy đơn hàng" (Cancel) |
| `confirmed`, `processing` | "Hủy đơn hàng" (Cancel — store policy may restrict) |
| `shipped` | None (in transit) |
| `delivered` | "Yêu cầu hoàn trả" (Return), "Mua lại" (Re-order) |
| `cancelled` | "Mua lại" (Re-order) |
| `return_requested` | View return request status |
| `returned` | None |

For cancel and return actions, navigate to the respective flow. See [../cancel-return/README.md](../cancel-return/README.md).

## Deep link handling

Deep links arrive from push notifications when the BO updates order status. The link is `khanhstore://orders/:orderId`.

On receiving the notification and navigating to the screen, the query will refetch because `staleTime = 1 minute` and the notification likely arrives after a status change. Call `queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(orderId) })` in the notification handler before navigating to ensure the latest status is shown:

```ts
// libs/notifications.ts — notification response handler
Notifications.addNotificationResponseReceivedListener((response) => {
  const { orderId } = response.notification.request.content.data;
  if (orderId) {
    // Invalidate so the screen fetches fresh data immediately
    queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(orderId) });
    router.push(`/orders/${orderId}`);
  }
});
```

## Pull-to-refresh

Same pattern as the order list — `RefreshControl` with the `refetch()` function from `useOrder()`.

## VietQR / Bank Transfer orders

For orders paid by bank transfer, show the VietQR code on the order detail screen until payment is confirmed. The user may need to return to the app and scan from the order detail if they didn't complete the transfer during checkout.

```tsx
{order.paymentMethod === 'bank_transfer' && order.status === 'pending' && (
  <VietQRCard
    amount={order.total}
    orderReference={order.number}
    bankAccount={store.bankAccount}
  />
)}
```
