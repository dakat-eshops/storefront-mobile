# 02 · Push Integration for Loyalty Restoration

When BO approves a cancel or issues a return refund it sends a push notification to the customer's device. The payload includes `loyaltyPointsRestored` when a non-zero restoration was computed. This file documents the payload shapes, the notification handler, and the invariants mobile must uphold.

## Push payload shapes

These payloads are sent by `BO FoNotificationService.sendPush()`. They are the **same typed shapes** documented in [../cancel-return/04-status-updates.md](../cancel-return/04-status-updates.md), extended here with the loyalty-specific contract.

### Cancel status notification

```ts
interface CancelStatusNotification {
  type: 'cancel_status_update';
  orderId: string;
  cancelRequestId: string;
  status: 'approved' | 'partially_cancelled' | 'rejected';
  loyaltyPointsRestored?: number;   // integer ≥ 0; absent or 0 on rejected
}
```

`loyaltyPointsRestored` is present and `> 0` only when:
- `status === 'approved'` (full cancel) — full `loyaltyPointsUsed` is restored.
- `status === 'partially_cancelled'` — proportional share restored (`floor(used × approvedSubtotal / orderSubtotal)`).

### Return status notification

```ts
interface ReturnStatusNotification {
  type: 'return_status_update';
  orderId: string;
  returnRequestId: string;
  status: 'approved' | 'items_received' | 'inspected' | 'refund_issued' | 'partially_refunded' | 'rejected';
  refundAmount?: number;             // net cash refund; absent until refund_issued
  loyaltyPointsRestored?: number;    // integer ≥ 0; only on refund_issued / partially_refunded
}
```

`loyaltyPointsRestored` is present and `> 0` only on `refund_issued` or `partially_refunded` status. Do NOT expect it on `approved`, `items_received`, `inspected`, or `rejected`.

## Notification handler

Register in `app/_layout.tsx` — the root layout is mounted before any route, which covers the killed-app cold-start case.

```ts
// libs/notifications.ts

// Background / killed — user taps the notification
Notifications.addNotificationResponseReceivedListener((response) => {
  const data = response.notification.request.content.data as
    | CancelStatusNotification
    | ReturnStatusNotification;

  switch (data.type) {
    case 'cancel_status_update': {
      queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(data.orderId) });
      if (data.loyaltyPointsRestored && data.loyaltyPointsRestored > 0) {
        queryClient.invalidateQueries({ queryKey: profileQueryKeys.detail() });
      }
      router.push(`/orders/${data.orderId}`);
      break;
    }
    case 'return_status_update': {
      queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(data.orderId) });
      if (
        (data.status === 'refund_issued' || data.status === 'partially_refunded') &&
        data.loyaltyPointsRestored && data.loyaltyPointsRestored > 0
      ) {
        queryClient.invalidateQueries({ queryKey: profileQueryKeys.detail() });
      }
      router.push(`/orders/${data.orderId}`);
      break;
    }
  }
});

// Foreground — app is open
Notifications.addNotificationReceivedListener((notification) => {
  const data = notification.request.content.data as
    | CancelStatusNotification
    | ReturnStatusNotification;
  const hasRestore =
    'loyaltyPointsRestored' in data &&
    data.loyaltyPointsRestored !== undefined &&
    data.loyaltyPointsRestored > 0;

  showToast({
    title: notification.request.content.title ?? 'Cập nhật đơn hàng',
    body: hasRestore
      ? `${notification.request.content.body ?? ''}\n+${data.loyaltyPointsRestored} điểm hoàn trả`
      : (notification.request.content.body ?? ''),
    action: 'orderId' in data ? () => router.push(`/orders/${data.orderId}`) : undefined,
  });

  // Invalidate regardless — keeps data fresh even when user doesn't tap
  if ('orderId' in data) {
    queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(data.orderId) });
  }
  if (hasRestore) {
    queryClient.invalidateQueries({ queryKey: profileQueryKeys.detail() });
  }
});
```

## Where `profileQueryKeys` comes from

`profileQueryKeys` does not exist yet in the mobile app (snapshot: 2026-05-16). It will be defined alongside the NestJS fo-mobile profile endpoint in Phase M1. Until then, comment-out the `profileQueryKeys.invalidateQueries` call or guard it:

```ts
// TODO(Phase M1): uncomment once profileQueryKeys is defined
// queryClient.invalidateQueries({ queryKey: profileQueryKeys.detail() });
```

See [03-implementation-plan.md § M1](03-implementation-plan.md) for the endpoint spec.

## Invariants

1. **Never apply `loyaltyPointsRestored` locally.** Do not add the value to any cached balance. Refetch from the server — the profile endpoint is the source of truth.
2. **Invalidate on positive `loyaltyPointsRestored` only.** A zero or absent value means no wallet change occurred; skipping the profile invalidation avoids an unnecessary network request.
3. **Profile invalidation is best-effort.** If the device is offline when the push arrives, the user will see the updated balance the next time `useProfile` mounts and the query is stale. This is acceptable — push notifications are not guaranteed delivery anyway.
4. **Register handlers before `router` is available.** The Expo `router` object is safe after the root `_layout.tsx` renders. Register both listeners inside a `useEffect` in `_layout.tsx` with no deps, so they are stable across re-renders.
5. **`loyaltyPointsRestored` is an integer.** BO rounds down with `Math.floor`. Display as-is; do not re-round or convert.

## Missed push notifications

Push delivery is best-effort (OS can throttle or drop for offline devices). Do NOT rely on push as the sole mechanism for the user to learn about a restoration. The order detail screen and profile screen both refetch on mount (with `staleTime: 0`). The user can always pull-to-refresh to see the current state.
