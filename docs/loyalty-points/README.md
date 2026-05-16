# Loyalty Points — Mobile FO

Mobile is a **passive consumer** of the loyalty-points system. All wallet math (restore, earn, clawback, tier promotion) is computed server-side — by the FO web server or by BO. The mobile app surfaces the results via:

1. **Push notifications** — BO sends `loyaltyPointsRestored` when a cancel/return is approved.
2. **Profile balance fetch** — a planned `GET /fo-mobile/me/profile` endpoint (not yet in NestJS).
3. **Order detail loyalty fields** — `loyaltyPointsUsed`, `loyaltyPointsEarned`, `loyaltyPointsRestored` per order (not yet in the NestJS order detail response).

## Document index

| File | Topic |
| --- | --- |
| [01-mobile-lifecycle.md](01-mobile-lifecycle.md) | How each lifecycle phase (redeem → restore → earn → clawback → tier) reaches mobile |
| [02-push-integration.md](02-push-integration.md) | Push notification payloads from BO, handler wiring, foreground display |
| [03-implementation-plan.md](03-implementation-plan.md) | API gaps and UI components required for full mobile loyalty support |

## Lifecycle map (mobile perspective)

| Phase | Direction | Who computes | Mobile role | Status |
| --- | --- | --- | --- | --- |
| Redeem (`pointsUsed`) | wallet → order | FO at checkout | sends `loyaltyPointsUsed` in order payload | ❌ not started |
| Restore (`pointsRestored`) | order → wallet | BO on cancel/return approval | receives push; invalidates profile + order queries | ⏳ push payload documented; handler not wired |
| Earn (`pointsEarned`) | order → wallet | FO at `order_status = 'delivered'` (reads BO `loyaltyRatio`) | refetches profile; shows `+N điểm` on order detail | ❌ not started (BO Wave 2 shipped — unblocked on BO side) |
| Clawback (`pointsClawedBack`) | wallet → void | FO at cancel/return refund | same query invalidation as restore | ❌ not started |
| Tier promotion | spend → tier row | FO at order delivered (reads BO `spendThreshold`) | no mobile UI planned yet | ❌ not started |

## Key invariants

1. **Mobile never computes loyalty math.** All wallet mutations happen on the FO web server or via BO-driven webhooks. Mobile only reads the results.
2. **Push notification is the only push channel from BO to mobile.** The BO cannot call a webhook on the mobile client — it sends a push notification instead.
3. **`loyaltyPointsRestored` in a push notification is informational.** Mobile must NOT apply the value locally. Invalidate the profile query and let the server respond with the authoritative balance.
4. **`profileQueryKeys.detail()` must be invalidated** after any cancel/return push carrying a non-zero `loyaltyPointsRestored`. This key is not yet defined in the mobile app — see [03-implementation-plan.md § M1](03-implementation-plan.md).
5. **Integer points units.** BO rounds down with `Math.floor` before emission. Mobile can display the received integer directly without further rounding.

## Cross-references

- [../cancel-return/04-status-updates.md](../cancel-return/04-status-updates.md) — push payloads that carry `loyaltyPointsRestored`
- [../orders/02-order-detail.md](../orders/02-order-detail.md) — order detail screen (future: loyalty panel)
- FO web contract: [FO/KhanhStore/docs/loyalty_points/README.md](../../../../FO/KhanhStore/docs/loyalty_points/README.md)
- BO contract: [BO/e-Shops/docs/loyalty-points/README.md](../../../../BO/e-Shops/docs/loyalty-points/README.md)
