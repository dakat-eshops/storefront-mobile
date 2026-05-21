# Cancel & Return — Mobile FO

Cancel and return request flows for mobile.

> **Status**: These docs describe the **designed** mobile architecture. The NestJS `/fo-mobile/cancel-requests` and `/fo-mobile/return-requests` endpoints are planned but not yet implemented in the API. Mobile UI components are not started. The push notification payload shapes in `04-status-updates.md` are the most near-term piece — they land alongside BO cancel/return approval.

## Documents

| File | Topic |
| --- | --- |
| [01-mobile-architecture.md](01-mobile-architecture.md) | How mobile differs from web FO (no HMAC, no server layer, push-based BO pushback) |
| [02-cancel-flow.md](02-cancel-flow.md) | Cancel request mutation, NestJS endpoint, auto-approve, UX flow |
| [03-return-flow.md](03-return-flow.md) | Return request, multi-step form, evidence upload, partial returns |
| [04-status-updates.md](04-status-updates.md) | How BO decision arrives on mobile (push notification → order detail + profile query) |

## Key invariants

1. **No HMAC in mobile.** Web FO uses `BO_WEBHOOK_SECRET` in a server action to sign requests to NestJS. Mobile uses Clerk JWT + DeviceAttestation through the `/fo-mobile/` gateway — no server intermediary, no shared HMAC secret on device.
2. **BO pushback arrives as a push notification.** The BO cannot call a webhook on the mobile client (mobile has no server). The BO sends a push notification when a cancel/return decision is made. The app then refetches the updated order.
3. **Loyalty point restoration is applied server-side.** BO computes `loyaltyPointsRestored` and includes it in the push notification. Mobile does NOT apply the amount locally — it invalidates the profile query and refetches the authoritative wallet balance. See [../loyalty-points/02-push-integration.md](../loyalty-points/02-push-integration.md).
4. **Auto-approve logic is NestJS-side.** The mobile app submits the cancel/return request and the NestJS FO module evaluates the store's `cancel_return_policy`. Mobile does not re-implement this logic.
5. **`retry: 0` on cancel/return mutations.** Never auto-retry — a duplicate submission could create a second cancel/return request before the idempotency key is checked. Let the user decide to retry explicitly.

## Cross-references

- [../orders/02-order-detail.md](../orders/02-order-detail.md) — Cancel/return entry point (action buttons on order detail)
- [../push-v2/01-extended-events.md](../push-v2/01-extended-events.md) — Cancel/return push notification events
- [../loyalty-points/README.md](../loyalty-points/README.md) — Loyalty restoration via push notification (full mobile loyalty lifecycle)
- BO cancel/return: [BO/e-Shops/docs/cancel-and-return-orders/README.md](../../../../BO/e-Shops/docs/cancel-and-return-orders/README.md)
- FO web cancel/return: [FO/KhanhStore/docs/cancel_and_return_orders/README.md](../../../../FO/KhanhStore/docs/cancel_and_return_orders/README.md)
