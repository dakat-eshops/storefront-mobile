# Loyalty Points — Mobile FO

Mobile is a **passive consumer** of the loyalty-points system. All wallet math (restore, earn, clawback, tier promotion) is computed server-side — by the FO web server or by BO. The mobile app surfaces the results via:

1. **Push notifications** — BO sends `loyaltyPointsRestored` when a cancel/return is approved.
2. **Profile balance fetch** — a planned `GET /fo-mobile/me/profile` endpoint (not yet in NestJS).
3. **Order detail loyalty fields** — `loyaltyPointsUsed`, `loyaltyPointsEarned`, `loyaltyPointsRestored` per order (not yet in the NestJS order detail response).

> **Loyalty is optional and OFF by default.** The per-store master switch is BO's
> `loyalty.enabled`. When it is off there is no loyalty surface to show and no
> points move — so **every mobile loyalty UI must be gated on it**, the same way
> FO web gates on `useLoyaltyEnabled()`. Mobile has no read for this preference
> yet; wiring one is a prerequisite for any of the screens below, not a polish
> item. BO SSOT: `BO/e-Shops/docs/commerce/loyalty-points/09-how-to.md § 1b`.
>
> ⚠️ **Reconciled with BO + FO web on 2026-08-13.** Two entries in the lifecycle
> map below described a design superseded on 2026-07-05, and one named a column
> that exists in no repo. All three files in this folder were corrected — see the
> **Correction log** at the foot of this file before implementing from any of them.

## Document index

| File | Topic |
| --- | --- |
| [01-mobile-lifecycle.md](01-mobile-lifecycle.md) | How each lifecycle phase (redeem → restore → earn → clawback → tier) reaches mobile |
| [02-push-integration.md](02-push-integration.md) | Push notification payloads from BO, handler wiring, foreground display |
| [03-implementation-plan.md](03-implementation-plan.md) | API gaps and UI components required for full mobile loyalty support |

## Lifecycle map (mobile perspective)

| Phase | Direction | Who computes | Mobile role | Status |
| --- | --- | --- | --- | --- |
| Redeem (`pointsUsed`) | wallet → order | FO requests at checkout; **BO decides** (first-order gate + clamp to order total) and returns `loyaltyPointsApplied` | sends `loyaltyPointsUsed`; must debit/display BO's `loyaltyPointsApplied`, never its own requested figure | ❌ not started |
| Restore (`pointsRestored`) | order → wallet | BO on cancel/return approval | receives push; invalidates profile + order queries | ⏳ push payload documented; handler not wired |
| Earn (`pointsEarned`) | order → wallet | **BO** pre-computes at **order creation** (`orders.loyaltyPointsEarned` + `loyaltyRatioApplied`); FO credits that exact number to the wallet at `delivered` — it does **not** re-derive it | shows the pre-computed figure as *pending* from creation, *earned* only once delivered | ❌ not started (BO side shipped) |
| Clawback (`pointsClawedBack`) | wallet → void | FO at cancel/return refund | same query invalidation as restore | ❌ not started |
| Tier promotion | **cumulative points earned** (`profiles.lifetimePoints`) → tier row | FO at order delivered, against BO's `buyer_groups.pointsThreshold` | no mobile UI planned yet | ❌ not started |

## Key invariants

1. **Mobile never computes loyalty math.** All wallet mutations happen on the FO web server or via BO-driven webhooks. Mobile only reads the results.
2. **Push notification is the only push channel from BO to mobile.** The BO cannot call a webhook on the mobile client — it sends a push notification instead.
3. **`loyaltyPointsRestored` in a push notification is informational.** Mobile must NOT apply the value locally. Invalidate the profile query and let the server respond with the authoritative balance.
4. **`profileQueryKeys.detail()` must be invalidated** after any cancel/return push carrying a non-zero `loyaltyPointsRestored`. This key is not yet defined in the mobile app — see [03-implementation-plan.md § M1](03-implementation-plan.md).
5. **Integer points units.** BO rounds down with `Math.floor` before emission. Mobile can display the received integer directly without further rounding.
6. **Redeemed points are a TENDER, not a discount.** BO records them as a second `payments` row; `orders.total_amount` and `orders.discount_amount` stay at **full price**. So an order paid partly in points shows its full total — mobile must render the points contribution as a *payment line*, never by expecting a reduced total. Rendering it as a discount would show the customer a total that disagrees with what BO charged. BO SSOT: `docs/commerce/loyalty-points/11-redemption-tender.md`.
7. **Earning is gated on `delivered`, not `shipping`.** Points are visible as *pending* from order creation but are not spendable until the `delivered` webhook credits the wallet. A badge gated on `shipping` is the exact bug FO web fixed on 2026-07-19.

## Cross-references

- [../cancel-return/04-status-updates.md](../cancel-return/04-status-updates.md) — push payloads that carry `loyaltyPointsRestored`
- [../orders/02-order-detail.md](../orders/02-order-detail.md) — order detail screen (future: loyalty panel)
- FO web contract: [FO/KhanhStore/docs/loyalty-points/README.md](../../../KhanhStore/docs/loyalty-points/README.md)
- BO contract: [BO/e-Shops/docs/commerce/loyalty-points/README.md](../../../../BO/e-Shops/docs/commerce/loyalty-points/README.md)
- BO manual QA + vulnerability checklist: [12-manual-testing-guide.md](../../../../BO/e-Shops/docs/commerce/loyalty-points/12-manual-testing-guide.md)

## Correction log — 2026-08-13

Reconciled against BO `packages/db` + `apps/api` and FO web's loyalty folder.
**Documentation only — no mobile code exists to change yet**, which is exactly
why these mattered: this folder is the spec anyone building the mobile screens
would have implemented from.

| Was | Now | Why it mattered |
| --- | --- | --- |
| "Earn — **FO** computes at `order_status = 'delivered'` (reads BO `loyaltyRatio`)" | **BO** pre-computes at **order creation**; FO credits that number verbatim at `delivered` | Earning moved to BO in W3b (2026-07-05). Building mobile against the old model implies mobile/FO may re-derive an earn figure — it must not; the authoritative number is `orders.loyaltyPointsEarned`, written before the order is even paid. |
| "Tier promotion — **spend** → tier row … reads BO **`spendThreshold`**" | **cumulative points earned** (`profiles.lifetimePoints`) vs BO `buyer_groups.pointsThreshold` | `spendThreshold` **does not exist in any repo** — grep returns nothing in BO `packages/db` or `apps/api`. The ladder has always been points-based. `profiles.lifetimeSpend` exists but drives nothing. |
| FO web contract link → `docs/loyalty_points/` | `docs/loyalty-points/` | Underscore vs hyphen — the link was dead, so the "read the FO contract" instruction silently went nowhere. |
| No mention of the master switch | `loyalty.enabled` gate called out at the top | Default **OFF**. Every mobile loyalty surface must be gated on it or it will render a program the merchant has not enabled. |
| No mention of the tender model | Invariant 6 | An order paid partly in points keeps its **full** `total_amount`. A mobile total that subtracts redeemed points would disagree with what BO charged. |

Both sibling files were re-audited in the same pass and carried the same errors,
now corrected:

- **[01-mobile-lifecycle.md](01-mobile-lifecycle.md)** — Phase 3 said FO computes
  earning at delivery and quoted a formula subtracting
  `loyaltyPointsUsed × 1 VND/point`; that subtraction **exists in no repo** (FO
  web deleted the same claim from its own spec on 2026-08-08) and the `1 VND`
  constant was retired by the 2026-07-27 currency work. Phase 5 read
  `spendThreshold`. Phase 1 said the server caps redemption at
  `min(balance, totalAmount)` — BO cannot see the wallet and clamps against the
  **order total only**, so a mobile client that trusts a server-side balance
  check will let customers over-spend.
- **[03-implementation-plan.md](03-implementation-plan.md)** — gated Phase M5 on
  "BO Wave 2 landing"; Wave 2 shipped **2026-05-12**. Nothing server-side blocks
  mobile loyalty work today.

**Remaining gap, not yet planned anywhere**: mobile has no read for
`loyalty.enabled`. Add it before building any loyalty screen — `03`'s phase
table does not list it.
