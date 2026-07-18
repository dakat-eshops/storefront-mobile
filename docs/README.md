# storefront-mobile — docs

Documentation for the FO React Native app. Organized by phase so each batch of design notes stays self-contained instead of being overwritten as the project evolves.

## Folders

| Folder | Scope |
| --- | --- |
| [_initial/](./_initial/README.md) | The initial design set — architecture, setup, auth, API client, data layer, realtime, navigation, push, shared code, build/deploy. Written before/during Vertical-1 (browse + cart). Treat as **historical design intent**, not a live changelog. |
| [cart/](./cart/README.md) | Shopee-style cart item selection — `useCartSelection` hook, `ThreeStateCheckbox`, sticky bottom bar, Zustand cross-step handoff. Includes the cart code map + server-cart migration status. |
| [products/](./products/README.md) | PLP + PDP surfaces — code map, data source (`/fo-mobile/.../products` via `useApiClient`), related realtime/scan docs. |
| [content/](./content/README.md) | CMS content consumption (banners, policies, FAQs) via the NestJS content API — envelope, locale fallback, consent version pinning, rich text. |
| [payments/](./payments/README.md) | Payment method overview and mobile-specific payment flow (VietQR, app-switch, COD). |
| [checkout/](./checkout/README.md) | Full checkout flow: shipping address, payment selection, review & confirm, post-submission routing. |
| [orders/](./orders/README.md) | Order history (infinite scroll) and order detail screen, status mapping, deep links, VietQR polling. |
| [cancel-return/](./cancel-return/README.md) | Cancel and return request flows, mobile architecture (no HMAC), push-based BO pushback, auto-approve. |
| [loyalty-points/](./loyalty-points/README.md) | Loyalty points on mobile — passive consumer lifecycle, push notification restoration, implementation plan (profile balance, order detail fields, checkout redemption). |
| [wishlist/](./wishlist/README.md) | TanStack DB wishlist collection — guest (MMKV) + authed (query collection), toggle API, sync provider. |
| [push-v2/](./push-v2/README.md) | Extended push notification events, typed payload shapes, foreground/background/killed handlers, cold start. |
| [broadcast/](./broadcast/README.md) | Supabase Broadcast subscriber hooks, `AppState` reconnect, `setQueryData` patch pattern, channel reference. |
| [security/](./security/README.md) | iOS App Attest, Android Play Integrity, certificate pinning, jailbreak detection, ProGuard, replay protection. |
| [qr-code/](./qr-code/README.md) | QR code display for customers — `react-native-qrcode-svg`, payload schema (cross-repo SSOT shared with BO scanner), compatibility contract. |
| [barcode/](./barcode/README.md) | Product barcode display + scan — `react-native-barcode-svg`, `expo-camera` scanner, URL/resolver contract (cross-repo SSOT in BO `docs/barcode/`). |
| [scale-to-1m/](./scale-to-1m/README.md) | Pending RN items from the BO Scale-to-1M program — conditional requests (ETag/304) + `staleTime` adoption (BO task 9.4, deferred) and the `useAppActiveGate` simulator spot-check (BO task 11.6). |

## Conventions

- One folder per design phase / major workstream. Do not edit `_initial/` to track ongoing work — add a new sibling folder (e.g. `checkout/`, `push-v2/`) with its own `README.md`. The leading underscore on `_initial/` is intentional: it keeps the historical/foundation folder pinned to the top of any alphabetic file listing.
- Every folder MUST have a `README.md` (per the BO `CLAUDE.md` documentation rule, which this repo mirrors).
- **All documentation lives here** — never as `.md` files inside `features/`, `libs/`, `app/`, or other code folders (see `CLAUDE.md` → Documentation Rules).
- Cross-link with relative paths (e.g. `../_initial/04-api-client.md`).

## Cross-repo counterparts

Features spanning repos must stay in lock-step — update both sides in the same PR cycle. The web FO index is [FO/KhanhStore/docs/README.md](../../KhanhStore/docs/README.md); the parity notes per folder live in [CLAUDE.md → Web FO parity map](../CLAUDE.md#web-fo-parity-map-fokhanhstoredocs).

| Mobile doc | Web FO counterpart (`FO/KhanhStore/docs/`) | BO counterpart (`BO/e-Shops/docs/` unless noted) |
| --- | --- | --- |
| [cart/](./cart/README.md) | `cart/`, `CART_SYNC_IMPLEMENTATION.md` | — (cart is FO-owned; server cart in `apps/api/src/modules/fo-mobile/cart/`) |
| [wishlist/](./wishlist/README.md) | `wishlist/` | — |
| [checkout/](./checkout/README.md) | `shipping/`, `payments/` | `docs/commerce/shipping/` |
| [orders/](./orders/README.md) | `order-history/` | `docs/commerce/orders/order/` (SSOT — status lifecycle) |
| [cancel-return/](./cancel-return/README.md) | `cancel_and_return_orders/` | `docs/commerce/orders/cancel-and-return/` (SSOT — 00-fo-compatibility-contract) |
| [loyalty-points/](./loyalty-points/README.md) | `loyalty_points/` | `docs/commerce/loyalty-points/` (SSOT — 00-fo-compatibility-contract) |
| [payments/](./payments/README.md) | `payments/` | `docs/commerce/payments/` |
| [products/](./products/README.md) | `products/`, `pdp/`, `plp/` | — |
| [content/](./content/README.md) | `payloadcms/`, `blogs/`, `policies/`, `careers/` | `docs/cms/payloadcms/nestjs-content-api/` (SSOT — 00-fo-compatibility-contract) |
| [broadcast/](./broadcast/README.md) | `tanstack/`, `plp/05-realtime.md`, `inventory/` | `docs/data/supabase/realtime/` (SSOT — BROADCAST_FANOUT_GUIDE §5) |
| [qr-code/](./qr-code/README.md) | `qr-code/` | `docs/commerce/qr-code/` (SSOT — payload schema) |
| [barcode/](./barcode/README.md) | — | `docs/barcode/` (SSOT — 02-barcode-schema) |
| [push-v2/](./push-v2/README.md) | — (web has no push) | Webhook `type` values: `docs/commerce/orders/cancel-and-return/` push-back contract |
| [security/](./security/README.md) | — | `apps/api` guards (`ClerkMobileGuard`, `DeviceAttestationGuard`) |
