# Cancel & Return — Mobile FO

Cancel and return request flows for mobile.

## Documents

| File | Topic |
| --- | --- |
| [01-mobile-architecture.md](01-mobile-architecture.md) | How mobile differs from web FO (no server layer, push-based BO pushback) |
| [02-cancel-flow.md](02-cancel-flow.md) | Cancel request mutation, NestJS endpoint, auto-approve |
| [03-return-flow.md](03-return-flow.md) | Return request, evidence upload, partial returns |
| [04-status-updates.md](04-status-updates.md) | How BO decision arrives on mobile (push notification → order detail) |

## Key invariants

1. **No HMAC in mobile.** Web FO uses `FO_HMAC_SECRET` in a server action to sign requests to NestJS. Mobile uses Clerk JWT + DeviceAttestation through the `/fo-mobile/` gateway — no server intermediary.
2. **BO pushback arrives as a push notification.** The BO cannot call a webhook on the mobile client (mobile has no server). The BO sends a push notification when a cancel/return decision is made. The app then fetches the updated order.
3. **Loyalty point restores are applied server-side (NestJS + BO).** Mobile just reflects the updated `loyaltyPointsBalance` when it refetches the profile.
4. **Auto-approve logic is NestJS-side.** The mobile app submits the cancel/return request and the NestJS FO module evaluates the store's `cancel_return_policy`. Mobile does not re-implement this logic.

## Cross-references

- [../orders/02-order-detail.md](../orders/02-order-detail.md) — Cancel/return entry point (action buttons)
- [../push-v2/01-extended-events.md](../push-v2/01-extended-events.md) — Cancel/return push notification events
- BO cancel/return architecture: [BO/e-Shops/docs/cancel-and-return-orders/README.md](../../../../BO/e-Shops/docs/cancel-and-return-orders/README.md)
