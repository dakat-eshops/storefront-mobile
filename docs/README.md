# storefront-mobile — docs

Documentation for the FO React Native app. Organized by phase so each batch of design notes stays self-contained instead of being overwritten as the project evolves.

## Folders

| Folder | Scope |
| --- | --- |
| [_initial/](./_initial/README.md) | The initial design set — architecture, setup, auth, API client, data layer, realtime, navigation, push, shared code, build/deploy. Written before/during Vertical-1 (browse + cart). Treat as **historical design intent**, not a live changelog. |
| [payments/](./payments/README.md) | Payment method overview and mobile-specific payment flow (VietQR, app-switch, COD). |
| [checkout/](./checkout/README.md) | Full checkout flow: shipping address, payment selection, review & confirm, post-submission routing. |
| [orders/](./orders/README.md) | Order history (infinite scroll) and order detail screen, status mapping, deep links, VietQR polling. |
| [cancel-return/](./cancel-return/README.md) | Cancel and return request flows, mobile architecture (no HMAC), push-based BO pushback, auto-approve. |
| [wishlist/](./wishlist/README.md) | TanStack DB wishlist collection — guest (MMKV) + authed (query collection), toggle API, sync provider. |
| [push-v2/](./push-v2/README.md) | Extended push notification events, typed payload shapes, foreground/background/killed handlers, cold start. |
| [broadcast/](./broadcast/README.md) | Supabase Broadcast subscriber hooks, `AppState` reconnect, `setQueryData` patch pattern, channel reference. |
| [security/](./security/README.md) | iOS App Attest, Android Play Integrity, certificate pinning, jailbreak detection, ProGuard, replay protection. |

## Conventions

- One folder per design phase / major workstream. Do not edit `_initial/` to track ongoing work — add a new sibling folder (e.g. `checkout/`, `push-v2/`) with its own `README.md`. The leading underscore on `_initial/` is intentional: it keeps the historical/foundation folder pinned to the top of any alphabetic file listing.
- Every folder MUST have a `README.md` (per the BO `CLAUDE.md` documentation rule, which this repo mirrors).
- Cross-link with relative paths (e.g. `../_initial/04-api-client.md`).
