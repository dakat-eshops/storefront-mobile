# Orders — Mobile FO

Order history and order detail screens.

## Documents

| File | Topic |
| --- | --- |
| [01-order-history.md](01-order-history.md) | Order list screen, pagination, pull-to-refresh |
| [02-order-detail.md](02-order-detail.md) | Order detail screen, status tracking, deep links |

## Key invariants

1. **Authenticated only.** Order routes require a Clerk session. Redirect to sign-in if not authenticated.
2. **No ElectricSQL.** Order data is fetched via TanStack Query (not ElectricSQL — HMAC URL extraction issue on mobile). See [../_initial/05-data-layer.md](../_initial/05-data-layer.md).
3. **Pull-to-refresh invalidates the order query.** Order status can change from an external BO action (e.g., merchant marks as shipped). Users need a reliable way to refresh.
4. **Push notifications navigate to order detail.** When the BO sends a status-change push, the deep link is `khanhstore://orders/:orderId`. See [../push-v2/01-extended-events.md](../push-v2/01-extended-events.md).

## Code map

| File | Purpose |
| --- | --- |
| [features/orders/collections/queryKeys.ts](../../features/orders/collections/queryKeys.ts) | Query keys |
| [features/orders/hooks/use-orders.ts](../../features/orders/hooks/use-orders.ts) | Order history list (infinite scroll) |
| [features/orders/hooks/use-order-detail.ts](../../features/orders/hooks/use-order-detail.ts) | Order detail |
| [features/orders/components/OrderQrCode.tsx](../../features/orders/components/OrderQrCode.tsx) | Customer QR for the BO scanner ([../qr-code/](../qr-code/README.md)) |
| [features/orders/types.ts](../../features/orders/types.ts) | Response types |
| [app/orders.tsx](../../app/orders.tsx) + [app/orders/[orderId]/](../../app/orders/[orderId]/) | Screens (history, detail, cancel, return) |

## Cross-references

- [../cancel-return/README.md](../cancel-return/README.md) — Cancel and return request flows
- [../_initial/08-push-notifications.md](../_initial/08-push-notifications.md) — Push basics
- [../push-v2/README.md](../push-v2/README.md) — Order lifecycle push events
