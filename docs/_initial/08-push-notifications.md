# 08 · Push Notifications

Two event sources drive push notifications on FO mobile:

1. **Order lifecycle** (`order_status_changed` BO → FO webhook, then FO → mobile push).
2. **Cancel / return status updates** (`cancel_status_update` / `return_status_update` BO → FO webhooks, then FO → mobile push).

Both already exist as BO → FO webhooks; mobile push is an additional fan-out leg the FO web layer adds.

## Expo Push (recommended)

Use **Expo Notifications** + **Expo Push Service** instead of raw APNs / FCM. Expo Push:

- Single API for iOS + Android.
- Free at any scale relevant here.
- Forwards to APNs / FCM under the hood with no app-side credential management.
- Reliably delivers `data` payloads even when the app is killed.

```bash
pnpm add expo-notifications expo-device
```

## Permission + token registration

```ts
// libs/notifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useApiClient } from '@/libs/api-client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice) return null;        // simulators can't get tokens

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenResp = await Notifications.getExpoPushTokenAsync({ projectId });
  return tokenResp.data;       // ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
}
```

After sign-in, POST the token to the mobile gateway:

```ts
const token = await registerForPush();
if (token) await api.post('/me/push-tokens', { token, platform: Platform.OS });
```

The mobile gateway writes this to a `profile_push_tokens` table. **This table must live in
`packages/db/src/tables/` (`@eshops/db`) so NestJS can write to it via Drizzle.** Do NOT
put it only in the FO web's `src/drizzle/tables/` — NestJS cannot see that schema.

Minimum schema:

```ts
// packages/db/src/tables/system/profilePushToken.ts
export const ProfilePushTokenTable = pgTable('profile_push_tokens', {
  id,
  profileId: uuid('profile_id').notNull(),
  token: varchar('token', { length: 512 }).notNull(),
  platform: varchar('platform', { length: 10 }).notNull(),   // 'ios' | 'android'
  lastSeenAt: timestamp('last_seen_at').defaultNow(),
  isActive: boolean('is_active').default(true),
  createdAt,
});
```

One profile may have multiple tokens (multiple devices). Mark `isActive = false` when Expo
returns `DeviceNotRegistered` in a push receipt — never hard-delete, so re-installs
re-activate the same row via upsert on `(profile_id, token)`.

## Sending push from NestJS

The FO web layer (already the recipient of `order_status_changed` and cancel/return webhooks from BO) extends its webhook handler to also fan out to Expo Push:

```ts
// FO web (or NestJS, if you move the webhook handling there)
async function sendPush(profileId: string, payload: PushPayload) {
  const tokens = await db.select(...).from(profilePushTokens).where(eq(profilePushTokens.profileId, profileId));
  if (!tokens.length) return;

  const messages = tokens.map((t) => ({
    to: t.token,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: { url: payload.deepLink },     // consumed by addNotificationResponseReceivedListener
  }));

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });
  // Inspect res for invalid-token receipts; mark stale tokens inactive
}
```

This is fire-and-forget from the webhook critical path — same rule as Supabase Broadcast: never let Expo Push downtime block a database mutation.

## Event → push mapping

| Source webhook | Title | Body | Deep link |
| --- | --- | --- | --- |
| `order_status_changed` (`confirmed`) | "Đơn hàng đã xác nhận" | "Đơn #{orderNumber} đang được chuẩn bị." | `khanhstore://orders/{orderId}` |
| `order_status_changed` (`shipped`) | "Đơn hàng đang giao" | "Mã vận đơn: {trackingNumber}." | `khanhstore://orders/{orderId}` |
| `order_status_changed` (`delivered`) | "Đơn hàng đã giao" | "Đánh giá để nhận {pointsEarned} điểm." | `khanhstore://orders/{orderId}/review` |
| `cancel_status_update` (`approved`) | "Yêu cầu hủy được duyệt" | "Hoàn tiền sẽ về tài khoản trong 3–7 ngày." | `khanhstore://orders/{orderId}` |
| `return_status_update` (`refund_issued`) | "Đã hoàn tiền" | "Số tiền {refundAmount}đ + {pointsRestored} điểm." | `khanhstore://orders/{orderId}` |

Localize via i18n — the strings above are placeholder Vietnamese copy for illustration.

## Notification handling

When tapped:

```ts
// app/_layout.tsx
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

useEffect(() => {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const url = response.notification.request.content.data?.url;
    if (typeof url === 'string') router.push(url);
  });
  return () => sub.remove();
}, []);
```

When received in foreground: shown as a banner (per `setNotificationHandler` above) or silently used to invalidate queries:

```ts
Notifications.addNotificationReceivedListener((notif) => {
  const orderId = notif.request.content.data?.orderId;
  if (orderId) queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(orderId) });
});
```

## Compatibility rules (read `CLAUDE.md` invariants first)

- **No PII in push payloads.** `pointsEarned`, `refundAmount`, `orderNumber` are fine. `profileId`, `email`, `phone`, `cost_price`, `margin` are not. The push provider (Apple, Google, Expo) sees these payloads.
- **Idempotent on receipt.** Two pushes for the same `order_status_changed` event (retries, multi-device) must not double-count loyalty points. Mobile only invalidates queries; the wallet write is FO-server-owned.
- **Reuse the BO → FO webhook contract.** Don't invent a new payload. Mobile push = projection of an existing webhook, not a new event channel.
- **Foreground ≠ "user is reading."** Always pair push with a query invalidation so the UI reflects truth even if the user dismissed the banner.

## What NOT to do

- ❌ Send a push for **every** Supabase Broadcast event (inventory tick, price change). Push is for events the user explicitly subscribed to (their orders, their cancellations). Inventory changes are realtime UI updates, not notifications.
- ❌ Send marketing pushes through the order webhook path. Marketing pushes (promotions, abandoned cart) belong to a separate scheduler, with explicit opt-in, and per Apple/Google policy must be controllable in-app.
- ❌ Embed Clerk session tokens or HMAC secrets in push payloads.
- ❌ Use `silent` (data-only) pushes to wake the app for background sync without user-visible UI on iOS. Apple throttles these aggressively; the feature is unreliable.
