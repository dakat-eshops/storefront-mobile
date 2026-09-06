# CLAUDE.md

Guidance for Claude Code when working with this repository (**FO Mobile** — the React Native / Expo customer storefront).

**Context**: This is the **third surface** of the e-Shops system — the native sibling of the Next.js FO web app (`FO/KhanhStore`). Same NestJS backend, same Clerk identity, same `@eshops/db` types (types only). It exists to capture mobile-only affordances — push notifications, offline cart, QR display, deep links, native payment app-switch — **not** to re-implement the web storefront.

**System architecture** (three repos, one backend):

| Repo | Tech | Role | NestJS path prefix |
| --- | --- | --- | --- |
| `BO/e-Shops` | Next.js admin + NestJS API (`apps/api/`) | Admin + shared backend | `/2026-01/stores/:storeId/...` (Supabase Bearer + `INTERNAL_API_KEY`) |
| `FO/KhanhStore` | Next.js (web storefront) | Customer web | `/2026-01/fo/stores/:storeId/...` (HMAC, server-side) |
| `FO/storefront-mobile` (this repo) | Expo / React Native | Customer native | `/2026-01/fo-mobile/stores/:storeId/...` (Clerk JWT + device attestation, **no HMAC**) |

- **Multi-tenant**: each mobile build targets exactly one store via `EXPO_PUBLIC_DEFAULT_STORE_ID`.
- **Auth separation**: Clerk only (same Clerk org as web FO). Never touch Supabase Auth — the Supabase anon key here is for **Broadcast subscriptions only**.
- **Cross-repo rule**: any FO feature (cart, checkout, orders, cancel/return, payments, wishlist, realtime, loyalty) must be considered for **both** FO surfaces. A feature that ships on web but is absent/broken on mobile is incomplete work.

## Use the Skills — ALWAYS (CRITICAL)

**This repo's only local `.claude/skills/` are platform-layer** — the Vercel React Native / Expo skill set (`vercel-react-native-skills`, `vercel-composition-patterns`), vendored from `vercel-labs/agent-skills` and model-invoked. They carry no cross-repo contract; they are advisory and always subordinate to this file. **Everything contract-shaped is still consumed from the sibling repos.** Before writing code for any implementation or integration task, check the indexes below and invoke the matching skill via the Skill tool:

| Library | Covers | Index |
| --- | --- | --- |
| **BO** (shared, cross-repo — check first) | Every BO↔FO contract surface: cache tags, Broadcast payloads/channels, HMAC headers, webhook schemas, entity attributes, feature toggles (BO half), PayloadCMS collections, migrations, CI/CD | [BO/e-Shops/.claude/skills/README.md](../../BO/e-Shops/.claude/skills/README.md) |
| **FO web** | Customer-domain entity scaffolding, feature-toggle FO read, FO test layers — the closest existing analogue for most mobile work | [FO/KhanhStore/.claude/skills/README.md](../KhanhStore/.claude/skills/README.md) |
| **This repo** (platform-only) | RN/Expo list perf, animation, native modules, React composition | [.claude/skills/README.md](.claude/skills/README.md) |

**This is not a suggestion.** Every wire contract this app depends on is owned elsewhere (see [Cross-Repo Contracts](#cross-repo-contracts-ssots-live-elsewhere--never-fork-them-here)), and the skills are what encode the ordering and hand-off rules for changing them safely.

**The rules:**

1. **Check the BO index first for anything that crosses a repo boundary** — a Broadcast payload, a channel name, a header, a webhook shape, a cache tag. Those originate in BO; a skill exists for nearly all of them.
2. **Never fork or unilaterally edit a contract here.** Mirror it. If the SSOT needs to change, that change happens in the owning repo — then this repo mirrors it, per the Cross-Repo Contracts table.
3. **A feature toggle is a BO decision.** `SITE_PREFERENCES_SCHEMA` + settings page + server gate is `/new-bo-toggle` in BO. Mobile only *reads* the resolved preference — never invent a mobile-local flag for a per-store feature, and never use an `EXPO_PUBLIC_*` env var for one (it cannot vary per tenant).
4. **Read the FO web counterpart before building the mobile version.** Per the cross-repo rule above, a feature that ships on web but is absent or divergent on mobile is incomplete work — the FO skill for that pattern is the fastest way to see what web actually did.
5. **When a BO/FO skill's steps don't fit Expo/React Native, adapt the platform layer — never the contract layer.** Wire format, key names, and auth flow stay identical; only the UI/storage/navigation implementation differs.
6. **If a skill is wrong or stale, fix it in its owning repo in the same change** — same rule as "Stale docs are a bug". Do not work around it silently.
7. **If a mobile-specific pattern gets repeated, add an authored skill to the local `.claude/skills/` library** — follow the conventions table in the BO README. Keep it platform-only; anything with a wire contract in it belongs in the BO library.

## Auth Model — THE Non-Negotiable

A mobile binary is statically analysable. **This app never ships a secret.**

- **Never bundle** `BO_WEBHOOK_SECRET`, `fo_api_secret`, HMAC keys, `INTERNAL_API_KEY`, or any Supabase service key. There is no `EXPO_PUBLIC_*` variant of any secret — if a value must stay private, mobile cannot hold it, period.
- The web FO signs NestJS requests with a per-store HMAC secret **server-side**. Mobile cannot replicate that, so it talks to a parallel controller set at **`/2026-01/fo-mobile/stores/:storeId/*`** (BO repo: `apps/api/src/modules/fo-mobile/`), guarded by:
  1. `ClerkMobileGuard` — optional Clerk JWT Bearer (anonymous fallback allowed for public reads; cart/orders require `profileId`)
  2. `DeviceAttestationGuard` — `x-device-attestation` header (iOS App Attest / Android Play Integrity). Dev-mode-permissive (`__unsupported__` accepted outside production); fails closed in production. Client side is a skeleton — see [libs/device-attestation.ts](libs/device-attestation.ts).
- The global NestJS `ApiKeyGuard` skips both `/fo/*` and `/fo-mobile/*`. Admin routes (`/2026-01/stores/...`) are off-limits from mobile.
- **Versioning convention** (matches BO CLAUDE.md): the `fo-mobile/` segment lives in the controller **path**, never in the version. Routes are `/2026-01/fo-mobile/...` — there is no `/fo-mobile/2026-01/...`.
- **New NestJS FO endpoint rule**: any new `/fo/` endpoint that mobile needs gets a parallel `/fo-mobile/` controller (guards-only — it MUST reuse the existing `FoXxxService` class, never duplicate business logic). See `apps/api/src/modules/fo-mobile/fo-mobile.module.ts` in the BO repo.

## FIX Command Protocol

When the user issues a **FIX** command targeting a specific screen or flow:

1. **Do NOT guess the root cause.** Never apply a fix based on assumptions.
2. **Add logs first** — instrument the relevant code paths (hooks, API client, realtime subscribers, screens) with as many `console.log` statements as needed to surface the actual data flow and error state.
3. **Wait for the user** to run the app and paste the Metro/console output.
4. **Diagnose from evidence** — read the logs, identify the real root cause, then apply a targeted fix.
5. **Keep debug logs in place after applying the fix.** Do NOT remove them until the user explicitly confirms the fix works. If the first attempt doesn't resolve the issue, leave the existing logs and add more.
6. **Only remove debug logs after the user confirms the fix is handled correctly.**
7. **Lock in the fix with a regression test.** Once the user confirms the fix works, add coverage that reproduces the original bug using whatever test infra exists for that surface at the time. **No test suite is wired yet in this repo** (see the note below) — until one exists, document the bug, its repro steps, and the fix in the relevant `docs/` folder so it can be manually re-verified in a future FIX pass, and flag the surface as a priority once a test runner is wired. Once a suite exists for a given surface, treat this the same as BO/FO-web: the test MUST fail against the pre-fix code and pass against the fix. Never close out a FIX with zero record of how to re-verify it.

> Rule: evidence before action. Never write a fix without first seeing logs that confirm the cause. Never consider a FIX closed without a regression test (or, until a suite exists, a documented re-verification note) locking it in.

## Documentation Rules

- **Docs first, then code.** Before implementing or modifying any feature, check whether [`docs/`](docs/README.md) already covers the area — search its top-level index and, for cross-repo features, the matching BO/FO doc (see the [Web FO parity map](#web-fo-parity-map-fokhanhstoredocs) below). If a doc exists, read it in full **before** writing code, and implement to match its documented design, contracts, and invariants — do not silently diverge from a decision that is already written down. If the doc is wrong, incomplete, or the requirement has genuinely changed, say so explicitly and update the doc **in the same change** (never after, never silently) — code and doc must never quietly disagree, even for the length of one PR. This is the proactive counterpart to "Stale docs are a bug" below — that rule catches drift after the fact; this one prevents it before the first line of code is written.
- **ALL documentation lives under [`docs/`](docs/README.md) — never inside `features/`, `libs/`, `app/`, or any code folder.** The `docs/` tree is the single documentation home, mirroring the BO pattern (`BO/e-Shops/docs/` + `BO/e-Shops/apps/api/docs/README.md`). Do NOT create `README.md` (or any `.md`) files inside `features/<feature>/` — feature documentation goes in `docs/<feature>/` with its own `README.md`. When a feature's contract notes are worth keeping, move them into the matching `docs/` folder and link code files from there. (The legacy `features/*/README.md` files were migrated into `docs/{cart,content,orders,products,wishlist}/` on 2026-07-18 — never add new ones.)
- **Stale docs are a bug.** Any doc in `docs/` that contradicts current code behavior is a defect — fix it with the same urgency as a code bug. A PR that changes behavior without updating the covering doc is incomplete.
- **Every `docs/` subfolder — at every depth — MUST have its own `README.md`** listing its sibling `.md` files and child subfolders. Write the `README.md` first when creating a new subfolder; update it in the same change when adding a sibling `.md`.
- **One folder per design phase / workstream** (this repo's convention — see [docs/README.md](docs/README.md)). Do NOT edit `docs/_initial/` to track ongoing work — it is frozen historical design intent. Add a new sibling folder (e.g. `docs/checkout/`, `docs/push-v2/`) instead.
- **Feature docs that required code changes MUST include an implementation plan / status section** (✅ / 🚧 / ⏳ + shipped file paths), same as the BO/FO rule. For mobile mirrors of cross-repo features, point at the BO-canonical plan and state the mobile-side status.
- Keep the top-level [docs/README.md](docs/README.md) folder table in sync when adding or removing subfolders.
- **Every new feature integration MUST log a history entry in Obsidian.** After shipping the feature's docs (README + implementation/status section), append an entry to the Obsidian note **`7 - Projects/e-commerce/app history/The new feature integrations`** in the same change — treat a missing entry as an incomplete deliverable, same as a missing `docs/` README. Read the note first to find the next sequential number, then append (never overwrite) two lines per feature: a numbered line with the feature name plus the integration datetime (`N. {Feature Name} — {YYYY-MM-DD HH:mm}:`, current date/time at the moment the entry is written), followed by an indented bullet line with the path to the feature's docs `README.md` (`- {path}`). If the feature spans multiple repos (BO / FO / mobile), add one path line per repo under the same numbered entry. Example:

  ```text
  1. Authentication — 2026-07-22 14:30:
   - @BO - e-Shops/docs/auth/authentication/README.md
  ```

  Use the `mcp__obsidian-vault__obsidian_patch_content` / `obsidian_append_content` Obsidian MCP tool to write the entry — never a manual/other channel.

## Cross-Repo Contracts (SSOTs live elsewhere — never fork them here)

| Contract | SSOT | Mobile mirror |
| --- | --- | --- |
| Broadcast channel names + payloads (`store:{storeId}:{topic}`) | BO `docs/data/supabase/realtime/BROADCAST_FANOUT_GUIDE.md` §5 | [libs/realtime/](libs/realtime/) subscriber hooks |
| QR payload schema (`{ v, s, o, r }`) | BO `docs/commerce/qr-code/02-qr-payload-schema.md` | [libs/qr.ts](libs/qr.ts) + [docs/qr-code/](docs/qr-code/README.md) |
| Barcode URL + resolver | BO `docs/barcode/02-barcode-schema.md` | [docs/barcode/](docs/barcode/README.md) |
| CMS content API (envelope, locale fallback, visibility) | BO `docs/cms/payloadcms/nestjs-content-api/00-fo-compatibility-contract.md` | [docs/content/](docs/content/README.md) — ⚠️ BO-side `FoMobileCmsModule` exists but is currently **not registered** in `FoMobileModule`; the mobile `/cms/*` routes are unmounted until it is re-imported |
| Cancel/return DTOs + push-back | BO `docs/commerce/orders/cancel-and-return/00-fo-compatibility-contract.md` | [docs/cancel-return/](docs/cancel-return/README.md) |
| Loyalty ownership matrix | BO `docs/commerce/loyalty-points/00-fo-compatibility-contract.md` | [docs/loyalty-points/](docs/loyalty-points/README.md) |
| Payments (VietQR, app-switch, COD) | BO `docs/payments/` + FO web `docs/payments/` | [docs/payments/](docs/payments/README.md) |
| `ApiResponse<T>` envelope | NestJS `ResponseInterceptor` (shared with web FO) | [libs/api-client.ts](libs/api-client.ts) |

Any change to a wire contract requires a **coordinated PR** in the owning repo(s). Channel names, event names, payload shapes, and header names are stable public contracts — never rename unilaterally.

### Web FO parity map (`FO/KhanhStore/docs/`)

The web FO documents the same customer features from the web side — check the counterpart before building or changing the mobile version, and keep UX/contract decisions in lock-step (see [FO/KhanhStore/docs/README.md](../KhanhStore/docs/README.md) for the full index):

| Mobile docs folder | Web FO counterpart | Parity notes |
| --- | --- | --- |
| [docs/cart/](docs/cart/README.md) | `KhanhStore/docs/commerce/cart/` + `CART_SYNC_IMPLEMENTATION.md` | Web = TanStack DB collections + `sessionStorage` handoff; mobile = MMKV + Zustand (RN has neither `window` nor `sessionStorage`) |
| [docs/wishlist/](docs/wishlist/README.md) | `KhanhStore/docs/commerce/wishlist/` | Web has the per-store BO enable toggle — honour it on mobile too |
| [docs/orders/](docs/orders/README.md) | `KhanhStore/docs/commerce/orders/order-history/` | Same status lifecycle; mobile adds push deep links + QR |
| [docs/cancel-return/](docs/cancel-return/README.md) | `KhanhStore/docs/cancel_and_return_orders/` | Web reaches NestJS via HMAC; mobile via `/fo-mobile/` (Clerk + attestation) |
| [docs/loyalty-points/](docs/loyalty-points/README.md) | `KhanhStore/docs/loyalty_points/` | FO web owns the wallet; mobile is a passive consumer + push restoration |
| [docs/payments/](docs/payments/README.md) | `KhanhStore/docs/commerce/payments/` | Mobile adds app-switch + VietQR polling flavors |
| [docs/products/](docs/products/README.md) | `KhanhStore/docs/commerce/products/` + `pdp/` + `plp/` | Web PDP/PLP guides define display + realtime behavior mobile mirrors |
| [docs/content/](docs/content/README.md) | `KhanhStore/docs/cms/payloadcms/` + `blogs/` + `policies/` + `careers/` | Same content collections, different read path (web: `/api/cms` REST; mobile: NestJS content API) |
| [docs/qr-code/](docs/qr-code/README.md) | `KhanhStore/docs/commerce/qr-code/` | Web renders `react-qr-code`; mobile `react-native-qrcode-svg`; BO owns the scanner |
| [docs/broadcast/](docs/broadcast/README.md) | `KhanhStore/docs/client/tanstack/` + `plp/05-realtime.md` + `inventory/` | Same channels; web adds ElectricSQL (mobile has none) — and web's "homepage never subscribes" cost rule applies to mobile's connection budget thinking |
| [components/ui/rich-text-content.tsx](components/ui/rich-text-content.tsx) | `KhanhStore/docs/rich_text/` | Web doc explicitly tracks the "mobile RN fallback" — allow-list SSOT is BO `docs/tiptap/` |

Web-only doc areas with **no mobile counterpart by design**: `responsive-ui/` (web breakpoints — RN is natively mobile), `admin/`, `system_cache/` / `guides/` cache architecture (mobile has no server cache — MMKV + TanStack Query only), `tanstack/` ElectricSQL shapes (no Electric on RN), `filter/`, `search_hints/`, `entity_translations/` (client-side locale resolution — adopt when mobile adds those surfaces).

## Development Commands

```bash
pnpm install
cp .env.example .env       # fill in EXPO_PUBLIC_* values

pnpm start                 # Expo dev server (Expo Go where possible)
pnpm ios                   # expo start --ios
pnpm android               # expo start --android
pnpm lint                  # expo lint (ESLint, eslint-config-expo flat)
npx tsc --noEmit           # type check (strict mode, no dedicated script yet)

# Native-module features (attestation, camera on some SDKs) need a dev client:
pnpm expo run:ios          # or: pnpm expo run:android
```

- **No database in this repo** — mobile owns no Postgres. All persistence is MMKV (device) or the NestJS backend. There are no `db:*` commands and no migrations here; schema changes happen in the BO repo (and are run manually by the user there).
- **No test suite is wired yet.** When adding one, follow the BO/FO testing philosophy (factories, AAA, `describe.each`) — and document the setup in `docs/`.
- `reset-project` script is an emergency Expo-starter reset — never run it.

## Tech Stack

| Category | Technologies |
| --- | --- |
| Framework | Expo ~54 / React Native 0.81 / React 19 + **Expo Router** (file-based, typed routes) |
| Auth | Clerk (`@clerk/clerk-expo`) — token cache in `expo-secure-store` ([libs/clerk-token-cache.ts](libs/clerk-token-cache.ts)) |
| Data | TanStack Query v5 + MMKV persister (offline-first) — see Data Layer below |
| Guest storage | `react-native-mmkv` (cart, wishlist, query cache) |
| UI state | Zustand (checkout selection handoff only) |
| Realtime | Supabase Broadcast (`@supabase/supabase-js`) — **subscribe-only**, anon key |
| Push | `expo-notifications` (Expo push service) |
| QR / barcode | `react-native-qrcode-svg`, `react-native-barcode-svg`, `expo-camera` (scan) |
| Rich text | `react-native-render-html` (CMS Lexical content via shared renderer) |

## Repo Layout

```text
app/                          # Expo Router routes
  _layout.tsx                 # ClerkProvider → PersistQueryClient → CartSync → Realtime → PushBootstrap → Stack
  (tabs)/                     # Home / Search / Cart / Account
  product/[id].tsx            # PDP
  orders.tsx + orders/[orderId]/{index,cancel,return}.tsx
  wishlist.tsx  scan.tsx  sign-in.tsx (modal)
features/                     # products, cart, wishlist, orders, cancel-return, checkout, content, profile
  <feature>/
    collections/queryKeys.ts  # query keys — NEVER hardcode inline arrays
    collections/storage.ts    # MMKV wrapper (cart, wishlist)
    hooks/                    # useQuery/useMutation hooks calling useApiClient
    components/               # feature UI
    types.ts
libs/
  api-client.ts               # useApiClient() → /2026-01/fo-mobile/stores/<storeId>; ApiResponse<T> + ApiError
  env.ts                      # typed EXPO_PUBLIC_* access (the ONLY place reading process.env)
  query-client.ts             # QueryClient + MMKV persister (buster: appVersion)
  device-attestation.ts       # App Attest / Play Integrity hook (skeleton, fail-closed in prod)
  push-notifications.ts       # Expo push token registration → POST /devices/push-token
  push-registration-bootstrap.tsx
  notifications.ts            # foreground/tap handlers → invalidate + router.push deep links
  qr.ts                       # order QR payload builder (BO scanner contract)
  supabase.ts                 # Broadcast-only Supabase client
  realtime/                   # inventory / prices / catalog subscribers + provider + useAppActiveGate
components/                   # shared UI (themed-*, ui/)
constants/theme.ts
docs/                         # ALL documentation (see Documentation Rules)
```

**Path aliases** ([tsconfig.json](tsconfig.json)): `@/*` → repo root. `@eshops/db/types` → BO's `packages/db/src/index.ts` — **types-only**. `@eshops/db` is Node-only at runtime; importing its runtime modules (Drizzle client, table defs) into the RN bundle is forbidden and will break the build.

## API Client Pattern

All NestJS calls go through `useApiClient()` ([libs/api-client.ts](libs/api-client.ts)):

```typescript
const api = useApiClient();
// GET /2026-01/fo-mobile/stores/{storeId}/products?limit=20
const products = await api.get<Product[]>('/products?limit=20');
```

- Base path `${EXPO_PUBLIC_API_BASE_URL}/${apiVersion}/fo-mobile/stores/${defaultStoreId}` — callers pass only the sub-path.
- Headers added automatically: `Authorization: Bearer <Clerk JWT>` (when signed in), `x-device-attestation` (when available), `x-app-version`.
- Responses are the standard `ApiResponse<T>` envelope; the client **unwraps `data`** and throws `ApiError` (with `status` + `body`) on failure. Hooks receive `T`, not the envelope.
- **Never `fetch` NestJS directly from a screen or hook** — always via `useApiClient()` so auth/attestation headers and error normalization stay in one place.
- **Never call web-FO paths** (`/fo/...`) or BO admin paths (`/stores/...`) from mobile.

## Data Layer (TanStack Query + MMKV)

**Read first**: [docs/_initial/05-data-layer.md](docs/_initial/05-data-layer.md).

- **Plain `useQuery` + `useMutation`** — mobile does NOT use TanStack DB's `localStorageCollectionOptions` (the browser collection driver references `window`, which RN lacks). Guest cart/wishlist are thin MMKV wrappers ([features/cart/collections/storage.ts](features/cart/collections/storage.ts)) exposed through query hooks with `staleTime: 0`.
- **Offline-first**: the shared `queryClient` ([libs/query-client.ts](libs/query-client.ts)) uses `networkMode: 'offlineFirst'`, `staleTime` 5 min, `gcTime` 24 h, no retry on 4xx, and an MMKV-backed persister keyed by `EXPO_PUBLIC_APP_VERSION` (version bump = cache bust). Don't fight these defaults per-hook without a reason.
- **Query keys (CRITICAL)**: ALL `queryKey` values MUST come from `features/<feature>/collections/queryKeys.ts`. Never hardcode `['products', id]` inline — same rule as BO/FO.
- **Realtime + push handlers write into the query cache** (`invalidateQueries` / `setQueryData`) — never into ad-hoc state.

### Cart & wishlist (current state)

- **MMKV is the source of truth on-device** for guest AND authed users. Key `storefront-cart-items` (unscoped — one build = one store; web FO scopes the same shape per store in localStorage).
- BO-side `/fo-mobile/cart` endpoints (Redis-backed per-profile cart + `POST /cart/sync`) **now exist** in `apps/api/src/modules/fo-mobile/cart/`. The client-side wiring is **pending**: [use-cart.ts](features/cart/hooks/use-cart.ts) and [cart-sync-provider.tsx](features/cart/components/cart-sync-provider.tsx) still carry stale "endpoint does not exist" comments and stay 100% local. When migrating: authed reads → `GET /cart`, mutations → `/cart/items`, sync provider → real `POST /cart/sync` + clear MMKV on success.
- Wishlist mirrors the cart pattern (MMKV + toggle hooks); see [docs/wishlist/](docs/wishlist/README.md).

### Checkout state (no sessionStorage on RN)

Cross-step checkout handoff (Shopee-style item selection → delivery → payment → review) uses an **in-memory Zustand store** ([features/checkout/store.ts](features/checkout/store.ts)) — deliberately ephemeral, no persister: an app-kill mid-checkout re-asks selection, same as Shopee. Web FO's `sessionStorage` handoff **cannot** be ported literally — `sessionStorage` does not exist in RN; use Zustand, navigation params, or MMKV. Always call `reset()` after order success AND on checkout abandon.

## Realtime (Supabase Broadcast — subscribe-only)

**Read first**: [docs/broadcast/](docs/broadcast/README.md) + [docs/_initial/06-realtime.md](docs/_initial/06-realtime.md).

- **ElectricSQL is NOT used on mobile** (and FO Electric is decommissioned repo-wide). The only realtime mechanism here is Supabase Broadcast on the shared channels `store:{storeId}:inventory` / `:prices` / `:catalog`.
- All subscribers mount once in [RealtimeProvider](libs/realtime/realtime-provider.tsx) (root layout) — one WebSocket multiplexes all topics.
- **Connection budget (CRITICAL)**: Supabase bills on peak concurrent connections. Every subscriber gates on [`useAppActiveGate`](libs/realtime/use-app-active.ts) — channels tear down shortly after the app backgrounds and rejoin on foreground **with a reconcile** (`invalidateQueries`), because Broadcast events during teardown are lost. Never add a subscriber that holds a connection while backgrounded.
- Handlers do targeted `invalidateQueries` / `setQueryData` against keys from `queryKeys.ts`. Payload shapes mirror the BO fan-out guide — BO is the source of truth; update the typed payloads here in the same PR as any BO payload change.
- All channels are torn down on sign-out so the next user doesn't inherit a session.

## Push Notifications

**Read first**: [docs/push-v2/](docs/push-v2/README.md).

- Registration: [libs/push-notifications.ts](libs/push-notifications.ts) — on sign-in, resolve Expo push token → `POST /devices/push-token`. Real devices only (simulators skip).
- Handling: [libs/notifications.ts](libs/notifications.ts) — foreground banners + tap handlers that invalidate the matching query keys and deep-link via `router.push` (e.g. `cancel_status_update` → `/orders/{orderId}`). Registered once in the root layout `useEffect`.
- Push payload `type` values mirror the BO → FO webhook types (`cancel_status_update`, `return_status_update`, `order_status_changed`, …) — cross-repo contract, never invent new ones unilaterally.

## Environment Variables

All config is `EXPO_PUBLIC_*` — **inlined into the bundle at build time and therefore public**. Read only via [libs/env.ts](libs/env.ts) (never `process.env` elsewhere); mirror new vars in [app.config.ts](app.config.ts) `extra`.

| Var | Notes |
| --- | --- |
| `EXPO_PUBLIC_API_BASE_URL` | NestJS base URL (e.g. `http://localhost:4000`) |
| `EXPO_PUBLIC_API_VERSION` | Defaults `2026-01` |
| `EXPO_PUBLIC_DEFAULT_STORE_ID` | Per-tenant store UUID |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Same Clerk org as web FO (publishable — safe) |
| `EXPO_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | Broadcast subscribe only (anon — safe) |
| `EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT_NUMBER` | Play Integrity |
| `EXPO_PUBLIC_APP_VERSION` | Query-cache buster |
| `EXPO_PUBLIC_FO_WEB_URL` | FO web origin for QR deep links |

**If a value would be dangerous in a decompiled APK, it cannot be an env var here.** Move the logic behind a `/fo-mobile/` NestJS endpoint instead.

## Hard Rules (consolidated)

1. **Never bundle a secret** (`BO_WEBHOOK_SECRET`, HMAC keys, service keys). Mobile talks to `/fo-mobile/*` only — never `/fo/*`, never admin routes.
2. **One NestJS backend** — new `/fo-mobile/` controllers are guards-only wrappers reusing existing `FoXxxService` classes. No mobile-only backend, no duplicated business logic.
3. **Broadcast channel/event names are an API contract** shared with web FO + BO — change only via coordinated PR.
4. **`@eshops/db` is types-only here** — never import its runtime into the RN bundle.
5. **No `'server-only'` / Next.js modules cross into mobile** — no `next/cache`, no `serverApi`, no `/server/queries/`.
6. **No `sessionStorage` / `localStorage` / `window`** — MMKV, SecureStore, Zustand, or navigation params.
7. **All docs in `docs/`** — never `.md` files inside `features/` or other code folders.
8. **Query keys from `queryKeys.ts`** — never inline arrays.
9. **All NestJS calls through `useApiClient()`** — never raw `fetch` to the backend.
10. **Realtime subscribers must gate on `useAppActiveGate`** and reconcile on rejoin.
11. **Mobile-first stays additive** — don't re-implement a screen the web FO already does well; ship the native-only affordances (push, offline, scan, deep links, app-switch payments).
12. **FO feature parity check** — before declaring any FO feature done (in any repo), verify whether this app needs the same change; if deferred, say so explicitly in the PR/plan.

## Reading Order Before Changing Anything

1. [docs/README.md](docs/README.md) — folder map (which workstream owns what)
2. [docs/_initial/04-api-client.md](docs/_initial/04-api-client.md) — the HMAC problem and the mobile-gateway pattern
3. [docs/_initial/05-data-layer.md](docs/_initial/05-data-layer.md) — TanStack Query + MMKV patterns
4. `BO/e-Shops/CLAUDE.md` + `FO/KhanhStore/CLAUDE.md` — cross-system invariants (this file only covers the mobile-specific deltas)
5. [FO/KhanhStore/docs/README.md](../KhanhStore/docs/README.md) — the web FO doc index; before building any customer feature here, read its web counterpart (see the parity map above)
