# 02 · Cancel Flow

## Entry point

The "Hủy đơn hàng" (Cancel order) button appears on the order detail screen when the order status is `pending` or `confirmed`. Tapping it opens a bottom-sheet reason picker before submitting.

## Cancel reason picker

```tsx
// features/cancel-return/components/cancel-reason-sheet.tsx
const CANCEL_REASONS = [
  { key: 'changed_mind', label: 'Tôi đổi ý không muốn mua nữa' },
  { key: 'wrong_item', label: 'Tôi đặt nhầm sản phẩm' },
  { key: 'duplicate_order', label: 'Tôi đặt trùng đơn hàng' },
  { key: 'shipping_too_slow', label: 'Thời gian giao hàng quá lâu' },
  { key: 'other', label: 'Lý do khác' },
];
```

When the user selects "Lý do khác", show a text input for a custom reason.

## Mutation

```ts
// features/cancel-return/hooks/use-cancel-order.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/libs/api-client';
import { orderQueryKeys } from '../../orders/collections/queryKeys';

export function useCancelOrder(orderId: string) {
  const queryClient = useQueryClient();
  const api = useApiClient();

  return useMutation({
    mutationFn: ({ reason, note }: { reason: string; note?: string }) =>
      api.post(`/cancel-requests`, {
        orderId,
        reason,
        note,
        foRequestId: generateId(),   // client-generated UUID for idempotency
      }),
    onSuccess: () => {
      // Invalidate order detail so status updates immediately
      queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(orderId) });
    },
    retry: 0,   // never auto-retry cancel — user must confirm again
  });
}
```

## Auto-approve result

NestJS evaluates the store's `cancel_return_policy`. If auto-approve conditions are met, the returned cancel request will have `status: 'approved'` immediately and the order status will reflect `cancelled`. If not, the cancel request status is `pending_review` and the user sees a "Chờ xác nhận" state on the order detail.

## UX flow

```text
Order detail screen
  │
  ▼ Tap "Hủy đơn hàng"
Bottom sheet: reason picker
  │
  ▼ Confirm
Loading overlay (retry: 0, single attempt)
  │
  ├─ Success (auto-approved): "Đơn hàng đã được hủy"
  │     → invalidate order detail → order status shows "Đã hủy"
  │
  └─ Success (pending review): "Yêu cầu hủy đã được gửi"
        → invalidate order detail → order shows "Chờ xuyết hủy"
  │
  └─ Error: show toast with reason; stay on order detail
```

## Error handling

| Error | User message | Action |
| --- | --- | --- |
| 409 — already cancelled | "Đơn hàng đã được hủy trước đó" | Refresh order detail |
| 422 — cannot cancel (shipped) | "Không thể hủy đơn hàng đang giao" | Dismiss sheet |
| 500 / timeout | "Có lỗi xảy ra. Vui lòng thử lại." | Allow retry via bottom sheet "Thử lại" button |
