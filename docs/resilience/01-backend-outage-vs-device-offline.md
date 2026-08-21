# 01 — Backend Outage vs. Device Offline

## Why this distinction matters

A user staring at stale product data with no explanation reads it as "the app is broken." The same
screen with "You're offline" reads as expected and non-alarming — the user knows why and knows what
to do (reconnect). Collapsing both cases into one generic "offline" message actively hurts trust
when the device's wifi icon is clearly full-bars and the app still says "offline."

## Detection

Combine two signals, not one:

```ts
// libs/network-status.ts
import NetInfo from '@react-native-community/netinfo';

export function useNetworkStatus() {
  const [state, setState] = useState<{ isConnected: boolean; isInternetReachable: boolean | null }>({
    isConnected: true,
    isInternetReachable: true,
  });

  useEffect(() => {
    return NetInfo.addEventListener((s) => {
      setState({ isConnected: s.isConnected ?? false, isInternetReachable: s.isInternetReachable });
    });
  }, []);

  return state;
}
```

| `isConnected` | `isInternetReachable` | Meaning |
| --- | --- | --- |
| `false` | — | **Device offline** — no radio connection at all. |
| `true` | `false` | **Device offline in practice** — connected to wifi with no internet (captive portal, router down). Treat the same as fully offline. |
| `true` | `true` / `null` | Device has a working connection. Any API failure from here is a **backend** problem, not a device one. |

Pair this with the same error-classification shape already built for web FO's infinite product
loading — port the enum, don't invent a parallel one:

```ts
// libs/api-error.ts — mirrors FO/KhanhStore's LazyLoadingErrorType
export enum ApiErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',   // fetch failed while isInternetReachable === true → backend/DNS/TLS issue
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',   // AbortController fired
  SERVER_ERROR = 'SERVER_ERROR',     // HTTP 5xx
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}
```

`useNetworkStatus().isInternetReachable === false` is checked **first**, before classifying the
API error — if the device is genuinely offline, don't bother distinguishing `TIMEOUT_ERROR` from
`SERVER_ERROR`; it's noise. Only classify the error type once the device claims to have a working
connection.

## The two banner states

```tsx
function ConnectivityBanner() {
  const { isInternetReachable } = useNetworkStatus();
  const lastApiErrorType = useLastApiErrorType(); // set by the api client on every failed request

  if (isInternetReachable === false) {
    return <Banner tone="neutral" message="You're offline — showing saved data." />;
  }
  if (lastApiErrorType === ApiErrorType.SERVER_ERROR || lastApiErrorType === ApiErrorType.TIMEOUT_ERROR) {
    return <Banner tone="warning" message="Having trouble reaching KhanhStore — showing saved data." />;
  }
  return null;
}
```

Both states serve the same MMKV-persisted cache underneath — this is a **messaging** layer on top
of the existing `offlineFirst` `networkMode`, not a new caching path. Nothing in
`_initial/05-data-layer.md`'s data-layer design changes; only what the user is told changes.

## What stays exactly as designed today

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

## Open item

The `ConnectivityBanner` pattern above is a **proposed** implementation shape, not yet verified
against the current mobile codebase. Before shipping: confirm whether an `ApiErrorType`-equivalent
classifier already exists on mobile (it may be partially there per
[`_initial/05-data-layer.md` § Error handling](../_initial/05-data-layer.md#error-handling)) and
extend it rather than introduce a second one.
