# 01 · Loyalty Points Lifecycle — Mobile Perspective

Mobile is a read-only participant in the loyalty system. This file maps each phase to exactly what the app must do and what the server handles on its behalf.

## Phase 1 — Redeem at checkout

**Direction**: wallet → order at checkout  
**Who decides**: **BO** — it applies the first-order gate and clamps to what the order total covers, then echoes the honoured figure as `loyaltyPointsApplied`  
**Who debits**: FO web owns the wallet and debits **BO's `loyaltyPointsApplied`**  
**Mobile role**: fetches wallet balance, lets the customer choose points to spend, sends the request — then renders **what BO applied**, never what it asked for

Required API at checkout:

```ts
// POST /fo-mobile/stores/:storeId/orders
{
  // ... existing fields
  loyaltyPointsUsed: number;   // 0 when not spending; a request, NOT a guarantee
}
// response carries the authoritative figure:
{
  loyaltyPointsApplied: number; // what BO actually honoured — may be 0 or clamped
}
```

Three things mobile must get right here:

1. **`loyaltyPointsApplied` is authoritative, and may be less than requested —
   or `0`.** BO rejects the redemption (not the order) when the first-order gate
   blocks it, and clamps when the request exceeds the order total. A checkout
   that displays the requested figure will tell the customer they spent points
   they still have.
2. **BO does NOT validate against the wallet balance** — FO owns the wallet, and
   BO cannot see it. The clamp is against the **order total** only. So the
   balance check is mobile's/FO's responsibility; do not assume the server will
   catch an over-spend.
3. **Redemption is a tender, not a discount.** `orders.total_amount` and
   `discount_amount` stay at **full price**; the points become a separate
   `payments` row. Render the points as a payment line, never by subtracting
   from the total — subtracting would show a total that disagrees with BO.

Never send a negative value; the DTO rejects it.

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

## Phase 3 — Earn: computed by BO at creation, credited by FO at delivery

> ⚠️ **Corrected 2026-08-13.** This section previously said FO computes earning
> inside the delivered-status transaction, and quoted a formula subtracting
> `loyaltyPointsUsed × 1 VND/point`. Both were wrong: earning moved to **BO at
> order creation** in W3b (2026-07-05), and that subtraction was **never
> implemented in any repo** — it was removed from FO web's spec on 2026-08-08
> as a documented-but-nonexistent rule. The `1 VND/point` constant was also
> retired by the 2026-07-27 currency work. See the correction log in
> [README.md](README.md).

**Direction**: order → wallet, in two distinct steps  
**Who computes**: **BO**, at **order creation** — it writes `orders.loyaltyPointsEarned` and `orders.loyaltyRatioApplied` before the order is even paid  
**Who credits**: **FO web**, on the `delivered` webhook — it credits BO's pre-computed number **verbatim**, with no re-derivation  
**Mobile role**: shows the figure as **pending** from creation; as **earned** only once the order is delivered

The split matters for mobile UI. `orders.loyaltyPointsEarned` is populated from
the moment the order exists, so a screen that renders "you earned N points" as
soon as it sees a non-zero value will claim points the customer cannot spend
yet. Gate the "earned" state on delivery:

```
pending:  loyaltyPointsEarned > 0 && status !== 'delivered'
earned:   loyaltyPointsEarned > 0 && status === 'delivered'
```

FO web ships exactly this (amber "pending" badge → green "earned" badge). Its
badge was gated on `shipping` until 2026-07-19; that was a bug — `shipping`
drives first-order tier graduation, **not** earning.

Earning base, for context only — **mobile must never compute this**:

```
eligibleSubtotal = max(subTotal − discountAmount, 0)
earnedPoints     = floor(eligibleSubtotal × loyaltyRatioApplied / 100 × currencyScale)
```

`currencyScale` derives from the store's ISO 4217 minor-unit exponent
(`general.currency`) and is never stored — see BO
`docs/commerce/loyalty-points/10-currency-handling.md`. Note redemption does
**not** reduce `discountAmount` (points are a tender, not a discount), so a
points-paid order still earns on that portion — a known, documented product
decision, not a bug.

There is no push notification for earning — mobile picks it up on next fetch.

Idempotency: FO's `loyalty_ledger` `UNIQUE(order_id, kind, source_ref)` makes a
replayed `delivered` webhook a no-op.

**Status**: ❌ not started on mobile. BO + FO web are both complete — the "blocked on BO Wave 2" note here was stale (Wave 2 shipped 2026-05-12). Nothing on the server side blocks mobile work now.

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

> ⚠️ **Corrected 2026-08-13.** This section previously described a **spend**-based
> ladder reading `BuyerGroupTable.spendThreshold`. That column **does not exist
> in any repo** — a grep over BO `packages/db` and `apps/api` returns nothing.
> The ladder has always been **points**-based. `profiles.lifetimeSpend` does
> exist but drives nothing.

**Direction**: profile **cumulative points earned** (`profiles.lifetimePoints`) → tier membership row  
**Who computes**: FO web server at order delivery (`resolveTierForPoints`), reading BO `buyer_groups.pointsThreshold`  
**Mobile role**: none today — but see the manual-override note below before building any tier UI

Auto-tier promotion is entirely server-side. When a delivered order pushes a
customer's `lifetimePoints` past a tier's `pointsThreshold`, FO swaps their
buyer-group membership. Mobile does not observe the event; it sees the result on
the next profile fetch.

Two behaviours any future mobile tier UI must respect:

- **A manually-assigned tier freezes auto-promotion.** Membership rows carry
  `isManual`; auto-promotion only ever touches `isManual = false` rows. A
  customer comped into `gold` by an admin stays there even after earning enough
  for `diamond`. Showing "N points to next tier" to such a customer would be a
  lie — check the flag first.
- **There is no auto-demotion.** Crossing back below a threshold never downgrades
  anyone (`loyalty.downgradeAllowed` exists as a preference but has **zero
  consumers** in either repo — v1 hard-codes no-demote).

**Status**: FO web v2.5 code complete (the webhook hook was wired 2026-08-01 — it had been marked shipped while never actually firing). No mobile UI planned.

---

## Summary: what mobile must never do

- Apply `loyaltyPointsRestored` locally to a cached balance — always refetch.
- Block a cancel/return mutation on a push notification failure.
- Run the earning or clawback formula client-side.
- Store `loyaltyPointsBalance` in MMKV or any persistent local store — it is always fetched fresh from the server.
