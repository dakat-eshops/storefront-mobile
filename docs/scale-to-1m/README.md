# Scale-to-1M — Pending RN Items

The BO repo runs the [Scale to 1M DAU program](../../../../BO/e-Shops/docs/misc/plans/How-to-handle-1-million-active-users-a-day/01-implementation-plan.md). All code-only dev-stage waves (BO tasks 7–12) shipped on 2026-07-03/04. Two items land in **this repo** and were deferred by owner decision ("RN is handled later") — this folder is their tracking doc so they don't get lost when mobile work resumes.

> **Status: ⏳ both open (as of 2026-07-04).** Neither blocks the BO/NestJS dev state. Neither is staging/prod-gated — both are local/simulator work in this repo.

| # | BO plan task | What | State |
| --- | --- | --- | --- |
| 1 | [Wave 2 / task 9.4](../../../../BO/e-Shops/docs/misc/plans/How-to-handle-1-million-active-users-a-day/01-implementation-plan.md) | Adopt HTTP conditional requests (ETag / 304) + generous TanStack Query `staleTime` on catalog screens | ⏳ Deferred until mobile work resumes (owner decision 2026-07-04) |
| 2 | [Wave 4 / task 11.6](../../../../BO/e-Shops/docs/misc/plans/How-to-handle-1-million-active-users-a-day/01-implementation-plan.md) | Simulator spot-check of `useAppActiveGate` — confirm the WS actually drops on background and rejoins on foreground | ⏳ Owner verification; code already shipped |

---

## 1. Conditional requests + `staleTime` (BO task 9.4)

### What the server already does (shipped BO-side, Wave 2 — 2026-07-04)

Every public unauthenticated GET on `/2026-01/fo-mobile/...` now returns:

- `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` — catalog/marketing routes (products, categories, catalogs, published-catalog, bundles, buffet-plans, promotions, campaigns, hero-section, realtime-flags)
- `Cache-Control: public, s-maxage=300, stale-while-revalidate=300` — store-config routes (site-preferences, payment-methods, shipment-methods, branches, store info, cancel-return policy, product-3d-models)
- A **strong `ETag`** (sha256 of the response envelope) — a repeat request with `If-None-Match` gets a **304 with empty body**
- `Vary: Authorization`

Everything else — and **any request carrying `Authorization` or `x-signature`** — is answered `no-store`. So the client-side win only exists for **unauthenticated catalog/config reads**; caller-keyed screens (cart, orders, wallet, me) are excluded by design.

### What this repo must do when mobile work resumes

1. **Send catalog/config GETs unauthenticated** where possible — mirror the FO-web `publicRead: true` pattern (`FO/KhanhStore/src/libs/server-api-client.ts`): a request that attaches a Clerk token is always `no-store`, which forfeits both the ETag win and the future CDN win (BO task 15.1).
2. **ETag cache in the API client** — RN `fetch` does not implement an HTTP cache reliably across platforms. Add a small ETag store (MMKV: `etag:{url}` → `{ etag, body }`) in the mobile API client: attach `If-None-Match` on request; on `304`, serve the stored body; on `200`, refresh the stored pair.
3. **Generous TanStack Query `staleTime` on catalog screens** — products list/detail, categories, catalogs, bundles, buffet-plans, hero-section: `staleTime` of minutes, not `0`. Freshness is already covered by the Broadcast subscriber hooks (`libs/realtime/{inventory,prices,catalog}.ts`) patching in-place + invalidating on rejoin — polling via low `staleTime` duplicates that at 1M-DAU request volume.
4. **Do not** apply any of this to caller-keyed data (cart, orders, wishlist, loyalty, me) — those are `no-store` server-side on purpose and must stay live.

**Done when:** a repeated catalog GET from the app logs a `304` (or an MMKV ETag hit) instead of a full-body `200`, and catalog screens don't refetch on every focus.

## 2. Simulator spot-check of `useAppActiveGate` (BO task 11.6)

### What shipped (Wave 4 — 2026-07-04)

[`libs/realtime/use-app-active.ts`](../../libs/realtime/use-app-active.ts) — `useAppActiveGate` with a **3s grace** (`APP_ACTIVE_GRACE_MS`, short so the teardown timer fires inside iOS's ~5s background-execution window; absorbs `inactive` flickers). Composed into all three subscriber hooks ([`inventory.ts`](../../libs/realtime/inventory.ts) / [`prices.ts`](../../libs/realtime/prices.ts) / [`catalog.ts`](../../libs/realtime/catalog.ts)), replacing the old rejoin-only `AppState` listener that never tore down on background. Each hook invalidates the products-list queries once per rejoin to reconcile missed events. There is no RN test runner in this repo yet, so this must be verified by hand.

### Verification checklist (owner, simulator or device)

1. Run the app; open a PDP (or any screen with an active Broadcast subscription — inventory/catalog).
2. Confirm the channel is joined — Supabase dashboard → Realtime → connections, or debug logs.
3. Background the app and wait **> 3 s**.
4. ✅ Confirm the WebSocket **drops** (connection count decrements / socket-close log).
5. Foreground the app.
6. ✅ Confirm the channel **rejoins** and the products-list queries **refetch** (the once-per-rejoin invalidation).
7. Quick flicker case: background for **< 3 s** and return — ✅ confirm the socket did **not** drop (grace absorbed it).
8. Record the result in this file (flip the status row above to ✅ with the date) and in the BO plan's daily log.

**Done when:** steps 4, 6, and 7 all confirmed; status tables updated in both repos.

---

## Cross-references

- BO implementation plan (SSOT for status): [01-implementation-plan.md](../../../../BO/e-Shops/docs/misc/plans/How-to-handle-1-million-active-users-a-day/01-implementation-plan.md) — tasks 9.4 / 11.6 + Open Items table
- BO strategy doc: [SCALE_TO_1M_USERS.md](../../../../BO/e-Shops/docs/misc/plans/How-to-handle-1-million-active-users-a-day/SCALE_TO_1M_USERS.md)
- Realtime lifecycle in this repo: [_initial/06-realtime.md](../_initial/06-realtime.md) · [broadcast/](../broadcast/README.md)
- FO-web equivalents (reference implementations): `FO/KhanhStore/src/libs/realtime/useVisibilityGate.ts` (visibility gate) · `FO/KhanhStore/src/libs/server-api-client.ts` (`publicRead`)
