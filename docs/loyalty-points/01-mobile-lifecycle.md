# 01 · Loyalty Points Lifecycle — Mobile Perspective

Mobile is a read-only participant in the loyalty system. This file maps each phase to exactly what the app must do and what the server handles on its behalf.

## Phase 1 — Redeem at checkout

**Direction**: wallet → order at checkout  
**Who computes**: FO web server validates the spend; NestJS fo-mobile persists `loyaltyPointsUsed` in the order row  
**Mobile role**: fetches wallet balance, lets the customer input points to spend, sends the amount in the order payload

Required API at checkout:

```ts
// POST /fo-mobile/stores/:storeId/orders
{
  // ... existing fields
  loyaltyPointsUsed: number;   // 0 when not spending; capped by server to min(balance, totalAmount)
}
```

The server validates the cap — mobile still sends whatever the user entered and lets NestJS reject out-of-bounds values with 422. Never allow a negative value.

**Status**: ❌ not started. Requires Phase M1 (balance endpoint) before a meaningful UI can be built. See [03-implementation-plan.md](03-implementation-plan.md).

---

## Phase 2 — Restore on cancel/return approval

**Direction**: BO computes restoration → FO web DB writes wallet increment → BO sends push notification to mobile  
**Who computes**: BO `CancelRequestsService` / `ReturnRequestsService` via `computeLoyaltyRestore()`  
**Mobile role**: receives push notification; invalidates profile + order queries

### Auto-approve path (synchronous)

For cancels that qualify for auto-approve, NestJS evaluates the store's `cancel_return_policy` on the same request. On mobile:

```text
POST /fo-mobile/stores/:storeId/cancel-requests
  → NestJS: auto-approve policy met?
      Yes → marks cancel approved + restores points in FO DB
             + BO FoNotificationService.sendPush(profileId, { type: 'cancel_status_update', status: 'approved', loyaltyPointsRestored: N })
             → push notification arrives on device
             → notification handler invalidates profile + order queries
      No  → status = 'pending'; no restoration yet
```

Unlike the web FO (which restores points locally before the BO confirms), mobile has no local DB. Restoration is always server-side, regardless of the auto-approve result.

### Manual review path (asynchronous)

```text
Customer submits cancel/return on mobile
  → BO admin opens review queue
  → Admin approves → BO computes loyaltyPointsRestored
  → BO sends push notification
  → Mobile handler invalidates queries
  → Customer pulls profile screen → sees updated balance
```

### Restoration rules (BO-side, mobile just receives)

| Event | Formula |
| --- | --- |
| Full cancel | `loyaltyPointsRestored = loyaltyPointsUsed` |
| Partial cancel | `floor(loyaltyPointsUsed × approvedSubtotal / orderSubtotal)` |
| Return refund | `floor(loyaltyPointsUsed × refundAmount / orderTotal)` |

Mobile never applies these formulas — it receives the pre-computed integer in the push payload.

**Status**: ⏳ push payload shapes documented in [../cancel-return/04-status-updates.md](../cancel-return/04-status-updates.md). Handler wiring incomplete — `profileQueryKeys` is not defined yet. See [03-implementation-plan.md § M3](03-implementation-plan.md).

---

## Phase 3 — Earn at delivery

**Direction**: order → wallet when order status transitions to `delivered`  
**Who computes**: FO web server, inside the delivered-status transaction  
**Mobile role**: refetches profile; shows `+N điểm` on order detail screen if `loyaltyPointsEarned > 0`

Earning is entirely server-side. Mobile learns about it the next time it fetches the profile or order detail. There is no push notification for earning — the app polls on next visit.

Earning formula (FO web side, for context):

```
earnedPoints = floor(eligibleSubtotal × loyaltyRatio / 100)
eligibleSubtotal = max(
  productSubTotal − couponDiscount − promotionDiscount − (loyaltyPointsUsed × 1 VND/point),
  0
)
```

`loyaltyRatio` is the customer's buyer-group earning rate (percent), resolved at delivery time from BO `BuyerGroupTable`.

Idempotency: `loyaltyPointsEarned > 0` on the FO order row acts as the guard — the earning trigger is a no-op on replay.

**Status**: ❌ not started on mobile. FO web code is complete. End-to-end is blocked on BO Wave 2 (`order_status_changed` webhook + buyer-group sync). No mobile UI planned until BO side ships.

---

## Phase 4 — Clawback on cancel/return

**Direction**: wallet → void on cancel/return when the order had earned points  
**Who computes**: FO web server inside the cancel/return mutation  
**Mobile role**: same query invalidation as Phase 2 (profile balance refetch reflects the clawback)

If a customer earned points on a delivered order and then cancels or returns it, the FO web server claws back the proportional points from the wallet atomically with the cancel/return mutation. Mobile receives the push notification from BO (same payload as Phase 2) and refetches the profile.

If the wallet is insufficient to cover the full clawback, the shortfall is deducted from the cash refund. The `refundAmount` in the push payload already reflects the net cash amount — mobile does not need to handle the shortfall math.

**Status**: ❌ not started on mobile. FO web code is complete. No additional mobile work is needed beyond Phase M3 push handler wiring.

---

## Phase 5 — Tier promotion

**Direction**: profile lifetime spend → tier membership row  
**Who computes**: FO web server at order delivery, reading BO `BuyerGroupTable.spendThreshold`  
**Mobile role**: none (tier changes reflected in buyer-group membership; no mobile UI planned yet)

Auto-tier promotion is entirely server-side. If a customer crosses a tier threshold at delivery, the FO promotes them in the buyer-group membership table. Mobile does not observe this event directly — the customer's active tier may affect future earning rates, but this is resolved by the server.

**Status**: FO web v2.5 code complete. No mobile UI planned.

---

## Summary: what mobile must never do

- Apply `loyaltyPointsRestored` locally to a cached balance — always refetch.
- Block a cancel/return mutation on a push notification failure.
- Run the earning or clawback formula client-side.
- Store `loyaltyPointsBalance` in MMKV or any persistent local store — it is always fetched fresh from the server.
