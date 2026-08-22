# 01 — Backend Outage vs. Device Offline

> **Status: ✅ Shipped.** This doc originally proposed the design below; it now describes what's
> actually in the codebase, corrected in two places against what the real code needed (see
> [Corrections from the original proposal](#corrections-from-the-original-proposal)).

## Why this distinction matters

A user staring at stale product data with no explanation reads it as "the app is broken." The same
screen with "You're offline" reads as expected and non-alarming — the user knows why and knows what
to do (reconnect). Collapsing both cases into one generic "offline" message actively hurts trust
when the device's wifi icon is clearly full-bars and the app still says "offline."

## Detection — two independent signals

**Device connectivity** — [`libs/network-status.ts`](../../libs/network-status.ts) wraps
`expo-network`'s `useNetworkState()`:

```ts
export function useNetworkStatus(): { isOffline: boolean } {
  const state = Network.useNetworkState();
  const isOffline = state.isConnected === false || state.isInternetReachable === false;
  return { isOffline };
}
```

`isInternetReachable` mirrors `isConnected` on iOS (no better signal available there); on Android it
additionally catches a connected-but-no-internet network (captive portal, router with no WAN).

**Backend reachability** — [`libs/connectivity-store.ts`](../../libs/connectivity-store.ts), a small
Zustand store `useApiClient` (`libs/api-client.ts`) reports into on every request:

```ts
interface ConnectivityState {
  backendUnreachable: boolean;
  reportUnreachable: () => void; // fetch itself threw, or our own timeout fired — no response received
  reportReachable: () => void;   // any response, success or error status — the backend WAS reached
}
```

The two signals are checked in that order: device-offline first (if the device has no connection,
classifying *why* the last request failed is noise), backend-unreachable second.

## The banner

[`components/connectivity-banner.tsx`](../../components/connectivity-banner.tsx), mounted once in
[`app/_layout.tsx`](../../app/_layout.tsx) above the `<Stack>` navigator (pushes content down, not an
overlay — stays visible over modals too since they render inside the same `<Stack>`):

```tsx
export function ConnectivityBanner() {
  const { isOffline } = useNetworkStatus();
  const backendUnreachable = useBackendUnreachable();

  if (!(isOffline || backendUnreachable)) return null;

  const message = isOffline
    ? "You're offline — showing saved data."
    : 'Having trouble reaching the server — showing saved data.';

  return <View style={styles.container}><Text style={styles.text}>{message}</Text></View>;
}
```

Both states serve the same MMKV-persisted TanStack Query cache underneath (`networkMode: 'offlineFirst'`,
already shipped per [`_initial/05-data-layer.md`](../_initial/05-data-layer.md)) — this banner is a
**messaging** layer on top, not a new caching path.

## What stays exactly as designed

Per the [existing offline behavior table](../_initial/05-data-layer.md#offline-behavior) — reaffirmed,
not changed, by this doc:

| Surface | Behavior |
| --- | --- |
| Product list / detail | Serve last cached response either way; stale banner if `dataUpdatedAt > 1h` |
| Cart / wishlist | Always works (MMKV-backed); sync queues on reconnect |
| Checkout | **Blocked** in both cases — requires fresh inventory + price + tax |
| Order history | Last cache only, no retry/spinner |
| Sign-in | Blocked in both cases |

## Recovery after either kind of gap

- **Broadcast** (`AppState` reconnect, see [`../broadcast/README.md`](../broadcast/README.md)) —
  on foreground after a background gap, reconnect the channel and do a full query invalidation.
  Events sent during the gap are lost either way (device-offline or backend-down), so this is the
  correct universal recovery step regardless of which caused the gap.
- **Push notifications** (see [`../push-v2/README.md`](../push-v2/README.md)) are the true
  out-of-band recovery channel for order-status changes — they're delivered by the OS, not the app's
  own network stack, so an order-status push can still arrive even through a window where the app
  itself couldn't reach the backend. Order detail should always re-fetch on push-open rather than
  trust the push payload as final state, same rule as the cancel/return push-back pattern on web FO.

## Corrections from the original proposal

Two things in the original design didn't survive contact with the real codebase:

1. **`@react-native-community/netinfo` is wrong for this project.** It's a bare React Native
   community module — it needs a custom dev client / prebuild to work reliably, and this app runs
   via plain `expo start` with no committed `ios`/`android` native folders (managed workflow).
   **`expo-network`** is the correct choice: first-party Expo SDK package, already SDK-version-matched
   (`~8.0.8` for Expo SDK 54 via `npx expo install`), and it ships its own `useNetworkState()` hook —
   no manual `addEventListener`/`useState` plumbing needed, which simplified `network-status.ts`
   below what the original snippet proposed.
2. **No `ApiErrorType` enum, and none was needed.** The real `ApiError` class
   (`libs/api-client.ts`) only carries `status` + `body` — there's no web-FO-style
   `NETWORK_ERROR`/`TIMEOUT_ERROR`/`SERVER_ERROR` classification, and porting one over would have
   been speculative scope beyond what this fix needs. The actual `fetch()` call also had **no
   timeout at all** (a second, separate gap — a stalled backend hung indefinitely, which is bad
   independent of this doc, since it also made "stalled backend" and "device lost connection
   mid-request" indistinguishable). Fixed both at once: `request()` now runs behind a 15 s
   `AbortController` (matching the ceiling on BO's `nestjsApiClient` and FO web's `serverApi`), and
   classifies outcomes with a single boolean rather than a multi-value enum — "did we get a response
   at all," reported into `connectivity-store.ts`. A caller-initiated abort (screen unmount) is
   explicitly excluded from `reportUnreachable()` so navigating away mid-request doesn't false-positive
   the banner.
