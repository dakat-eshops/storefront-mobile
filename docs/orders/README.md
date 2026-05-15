# Orders — Mobile FO

Order history and order detail screens.

## Documents

| File | Topic |
| --- | --- |
| [01-order-history.md](01-order-history.md) | Order list screen, pagination, pull-to-refresh |
| [02-order-detail.md](02-order-detail.md) | Order detail screen, status tracking, deep links |

## Key invariants

1. **Authenticated only.** Order routes require a Clerk session. Redirect to sign-in if not authenticated.
2. **No ElectricSQL.** Order data is fetched via TanStack Query (not ElectricSQL — HMAC URL extraction issue on mobile). See [../_initial/05-tanstack-query.md](../_initial/05-tanstack-query.md).
3. **Pull-to-refresh invalidates the order query.** Order status can change from an external BO action (e.g., merchant marks as shipped). Users need a reliable way to refresh.
4. **Push notifications navigate to order detail.** When the BO sends a status-change push, the deep link is `khanhstore://orders/:orderId`. See [../push-v2/01-extended-events.md](../push-v2/01-extended-events.md).

## Cross-references

- [../cancel-return/README.md](../cancel-return/README.md) — Cancel and return request flows
- [../_initial/06-push-notifications.md](../_initial/06-push-notifications.md) — Push basics
- [../push-v2/README.md](../push-v2/README.md) — Order lifecycle push events
