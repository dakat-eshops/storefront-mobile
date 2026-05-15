# 04 · Status Updates (BO → Mobile)

## Overview

Unlike web FO (which receives BO decisions via a server webhook), mobile has no server to receive webhooks. BO decisions (approve, reject) are communicated to mobile via push notifications.

## Push notification payload shapes

### Cancel request decision

```ts
interface CancelStatusNotification {
  type: 'cancel_status_update';
  orderId: string;
  cancelRequestId: string;
  status: 'approved' | 'rejected';
  loyaltyPointsRestored?: number;   // if auto-restore was applied
}
```

### Return request decision

```ts
interface ReturnStatusNotification {
  type: 'return_status_update';
  orderId: string;
  returnRequestId: string;
  status: 'approved' | 'items_received' | 'inspected' | 'refund_issued' | 'rejected';
  refundAmount?: number;             // when status = 'refund_issued'
  loyaltyPointsRestored?: number;
}
```

## Notification handler

```ts
// libs/notifications.ts
Notifications.addNotificationResponseReceivedListener((response) => {
  const data = response.notification.request.content.data;

  switch (data.type) {
    case 'cancel_status_update': {
      queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(data.orderId) });
      queryClient.invalidateQueries({ queryKey: profileQueryKeys.detail() });   // loyalty balance
      router.push(`/orders/${data.orderId}`);
      break;
    }
    case 'return_status_update': {
      queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(data.orderId) });
      if (data.status === 'refund_issued') {
        queryClient.invalidateQueries({ queryKey: profileQueryKeys.detail() });
      }
      router.push(`/orders/${data.orderId}`);
      break;
    }
  }
});
```

## In-app status display

When the user navigates to the order detail screen after a cancel/return notification, the screen re-fetches the order (invalidated above). The order detail shows:

- Updated order status badge
- A "Request status" section showing the cancel/return request status
- Loyalty points restored (if any), shown as `+N điểm` in green

## Foreground notifications

When the app is in the foreground, show an in-app toast/banner instead of a system notification. Expo Notifications fires `addNotificationReceivedListener` for foreground notifications:

```ts
Notifications.addNotificationReceivedListener((notification) => {
  const data = notification.request.content.data;

  // Show in-app toast
  showToast({
    title: notification.request.content.title ?? 'Cập nhật đơn hàng',
    body: notification.request.content.body,
    action: data.orderId ? () => router.push(`/orders/${data.orderId}`) : undefined,
  });

  // Also invalidate the query so when user navigates, data is fresh
  if (data.orderId) {
    queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(data.orderId) });
  }
});
```

## Missed notifications (killed app)

When the app is killed and the user taps the notification, Expo Notifications launches the app and fires `addNotificationResponseReceivedListener` on startup. The handler above covers this case. Ensure the handler is registered before `router` is available (register in the root `_layout.tsx` effect, after `router` is mounted).

## Reconciliation (reliability)

Push notifications are best-effort (the system may throttle or drop them). Do NOT rely on notifications as the sole delivery mechanism for status updates. The pull-to-refresh on the order detail and order history screens serves as the fallback reconciliation mechanism. Users should always be able to pull-to-refresh to see the latest status.
