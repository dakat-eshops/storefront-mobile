# Resilience — Local-First Fallback on Mobile

The mobile app's application of the cross-repo resilience strategy
([`BO/e-Shops/docs/platform/resilience/`](../../../../BO/e-Shops/docs/platform/resilience/README.md) —
SSOT for the principles) to a **real native client**, which is the one surface in this stack that
can genuinely go offline and keep working, rather than just degrading gracefully.

## Two different problems that look the same to the user

| | Device is offline | Backend is unreachable, device is online |
| --- | --- | --- |
| **Cause** | No wifi/cellular; airplane mode | NestJS/Supabase down or slow; a bad deploy; a transient 5xx |
| **Detected via** | `@react-native-community/netinfo` `isConnected` / `isInternetReachable` | An `ApiError` with a `SERVER_ERROR` / `TIMEOUT_ERROR` classification, `isInternetReachable` still `true` |
| **What should NOT change** | Cached reads still serve (MMKV-persisted TanStack Query cache); cart/wishlist still work (MMKV-backed collections) | Same — the cache doesn't care why the network call failed |
| **What SHOULD differ in the UI** | "You're offline" — expected, not alarming, the user knows why | "We're having trouble reaching KhanhStore — showing saved data" — a different message, because the user's wifi is visibly on and a generic "offline" banner reads as broken/buggy |

Today's design (see [`_initial/05-data-layer.md` § Offline behavior](../_initial/05-data-layer.md#offline-behavior))
already gets the **caching mechanism** right for both cases — `networkMode: 'offlineFirst'` serves
the persisted cache regardless of *why* the network call failed. What it doesn't yet do is
**message these two cases differently** to the user. See
[01-backend-outage-vs-device-offline.md](01-backend-outage-vs-device-offline.md) for the concrete
detection + messaging pattern.

> `_initial/` is pinned as **historical design intent, not a live changelog** per this repo's docs
> convention — this folder is the live status/extension of that original offline design, not a
> replacement for it. Read `_initial/05-data-layer.md` first for the baseline (MMKV persistence,
> `offlineFirst` query mode, the per-surface offline behavior table), then this folder for what's
> new: distinguishing *why* the cache is being served.

## Files in this folder

| File | Topic |
| --- | --- |
| [01-backend-outage-vs-device-offline.md](01-backend-outage-vs-device-offline.md) | Detection (NetInfo + reused `ApiError` classification), the two distinct banner states, and how push + Broadcast reconnect recover state after either kind of gap. |

## TL;DR

- **Cart, wishlist, and any already-fetched read data keep working either way** — that's the MMKV /
  `offlineFirst` design from `_initial/05-data-layer.md`, unchanged.
- **Checkout stays blocked either way** — it requires fresh inventory, price, and tax computation,
  same rule as web FO and BO.
- **The fix here is messaging, not caching**: reuse the web FO error-classification enum
  (`NETWORK_ERROR` / `TIMEOUT_ERROR` / `SERVER_ERROR` / ...) so the app can tell "no network" from
  "network is fine, server isn't answering" and show the right banner.
- **Push notifications + Broadcast `AppState` reconnect are the actual recovery mechanism** for
  anything that happened while backgrounded during either kind of gap — order-status pushes don't
  depend on the app having been foregrounded and connected at the moment the event fired.

## Related docs

- [`BO/e-Shops/docs/platform/resilience/`](../../../../BO/e-Shops/docs/platform/resilience/README.md) — SSOT for the overall strategy
- [`FO/KhanhStore/docs/platform/degraded-mode/`](../../../KhanhStore/docs/platform/degraded-mode/README.md) — web FO's application of the same strategy
- [`../_initial/05-data-layer.md`](../_initial/05-data-layer.md) — the original offline-first data layer design (MMKV, `offlineFirst`, per-surface table)
- [`../broadcast/README.md`](../broadcast/README.md) — `AppState` reconnect pattern for the realtime layer
- [`../push-v2/README.md`](../push-v2/README.md) — the out-of-band recovery channel for events missed while backgrounded
- [`FO/KhanhStore/docs/commerce/products/infinity-loading-products/04-error-handling-and-retry.md`](../../../KhanhStore/docs/commerce/products/infinity-loading-products/04-error-handling-and-retry.md) — the `LazyLoadingError` classification this folder proposes reusing on mobile
