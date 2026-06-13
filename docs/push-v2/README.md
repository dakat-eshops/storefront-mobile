# Push Notifications v2 — Extended Events

Order lifecycle and cancel/return push notifications (beyond the basic token registration covered in `_initial/08-push-notifications.md`).

## Documents

| File | Topic |
| --- | --- |
| [01-extended-events.md](01-extended-events.md) | Order lifecycle events, cancel/return events, payload shapes, deep links |
| [02-background-handlers.md](02-background-handlers.md) | Killed-app, background, and foreground notification handling |

## Key invariants

1. **Push is best-effort.** Do NOT rely solely on push for critical status updates. Pull-to-refresh on order history is the fallback.
2. **Deep links are the primary CTA.** Every push notification data payload includes `orderId` (and `cancelRequestId` / `returnRequestId` when relevant) so the user is taken directly to the relevant screen.
3. **Invalidate before navigating.** Always call `queryClient.invalidateQueries` for the relevant query key before navigating, so the destination screen shows fresh data.
4. **Token lifecycle.** On `DeviceNotRegistered` error from Expo Push Service, mark the token as `isActive = false` in `profile_push_tokens` — never hard-delete.
5. **Only send pushes to `isActive = true` tokens.** NestJS filters before calling Expo Push Service.

## Cross-references

- [../_initial/08-push-notifications.md](../_initial/08-push-notifications.md) — Token registration basics
- [../cancel-return/04-status-updates.md](../cancel-return/04-status-updates.md) — Cancel/return notification handling
- [../orders/02-order-detail.md](../orders/02-order-detail.md) — Deep link destination
