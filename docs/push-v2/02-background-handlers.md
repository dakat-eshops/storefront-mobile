# 02 · Background Notification Handlers

Expo Notifications fires different listeners depending on app state. This document covers all three states and what to do in each.

## App states

| State | Expo listener | Action |
| --- | --- | --- |
| **Foreground** (app open) | `addNotificationReceivedListener` | Show in-app toast; invalidate query — do NOT navigate |
| **Background** (suspended) | `addNotificationResponseReceivedListener` | Invalidate query; navigate to deep link |
| **Killed** (not running) | `addNotificationResponseReceivedListener` (fires on launch) | Invalidate query; navigate to deep link |

Background and killed are handled by the same listener — Expo surfaces them identically when the user taps.

## Listener registration

Register both listeners in the root `_layout.tsx` effect, after the `QueryClient` and `router` are available:

```tsx
// app/_layout.tsx
useEffect(() => {
  // Foreground: show toast, invalidate — no navigation
  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    const data = notification.request.content.data as PushPayload;
    handleForegroundPush(data, notification.request.content.title ?? '', router, queryClient);
  });

  // Background / killed: invalidate + navigate
  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as PushPayload;
    handleBackgroundPush(data, router, queryClient);
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}, [router, queryClient]);
```

## Foreground handler

```ts
// libs/notifications.ts
export function handleForegroundPush(
  data: PushPayload,
  title: string,
  router: Router,
  queryClient: QueryClient,
) {
  // Invalidate relevant queries so the screen is fresh if user navigates
  invalidateForPayload(data, queryClient);

  // Show in-app toast with optional "View" CTA
  toast.show(title, {
    action: getDeepLinkFromPayload(data)
      ? { label: 'Xem', onPress: () => router.push(getDeepLinkFromPayload(data)!) }
      : undefined,
  });
}
```

## Background / killed handler

```ts
// libs/notifications.ts
export function handleBackgroundPush(
  data: PushPayload,
  router: Router,
  queryClient: QueryClient,
) {
  // Invalidate first so the destination screen shows fresh data
  invalidateForPayload(data, queryClient);

  const deepLink = getDeepLinkFromPayload(data);
  if (deepLink) {
    router.push(deepLink);
  }
}
```

## Shared helpers

```ts
function invalidateForPayload(data: PushPayload, queryClient: QueryClient) {
  const orderId = 'orderId' in data ? (data.orderId as string) : undefined;
  if (orderId) {
    queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(orderId) });
    queryClient.invalidateQueries({ queryKey: orderQueryKeys.lists() });
  }
  if (data.type === 'return_status_update' && (data as ReturnStatusPush).status === 'refund_issued') {
    queryClient.invalidateQueries({ queryKey: profileQueryKeys.detail() });
  }
  if (data.type === 'cancel_status_update') {
    queryClient.invalidateQueries({ queryKey: profileQueryKeys.detail() });
  }
}

function getDeepLinkFromPayload(data: PushPayload): string | null {
  if ('orderId' in data && data.orderId) return `/orders/${data.orderId}`;
  if ('productSlug' in data && data.productSlug) return `/products/${data.productSlug}`;
  return null;
}
```

## Initial notification (cold start from a tapped notification)

Expo provides `Notifications.getLastNotificationResponseAsync()` to handle the case where the user tapped a notification and the app was not running. Call it once on mount in `_layout.tsx` after listeners are registered:

```ts
useEffect(() => {
  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) {
      const data = response.notification.request.content.data as PushPayload;
      handleBackgroundPush(data, router, queryClient);
    }
  });
}, []);   // run once on mount
```

## Silent push (data-only, no user-visible notification)

For background data refresh without showing a banner (e.g., invalidating a cache after an admin action), use `content-available: 1` on the Expo push message. Mobile should call `invalidateForPayload` without `router.push`. This is optional and requires a background fetch entitlement on iOS.
