# 03 · Implementation Plan — Loyalty on Mobile

## Current state (2026-05-16 snapshot)

The mobile app has **no loyalty UI or API surface**. The only loyalty touchpoints are:

- Push notification payloads documented in [../cancel-return/04-status-updates.md](../cancel-return/04-status-updates.md) (planned, not coded).
- This docs folder.

The FO web (KhanhStore) has v1 restoration shipped and v2 earning/clawback code-complete but blocked on BO Wave 2. Mobile must eventually reach feature parity.

---

## Phase M1 — Profile balance fetch

**Unblocks**: all other phases that show or use the wallet balance.

### NestJS change (fo-mobile module)

Add a profile endpoint in `apps/api/src/modules/fo-mobile/me/`:

```ts
// GET /2026-01/fo-mobile/me/profile
// Guard: ClerkMobileGuard (profile ID resolved from Clerk JWT)
// Response:
{
  id: string;
  displayName: string;
  avatarUrl: string | null;
  loyaltyPointsBalance: number;   // integer
}
```

The handler reads `profiles.loyalty_points_balance` via the existing `ProfilesDbService` or a dedicated `FoMobileProfileDbService`.

### Mobile changes

1. Create `features/profile/collections/queryKeys.ts`:

```ts
export const profileQueryKeys = {
  all: ['profile'] as const,
  detail: () => ['profile', 'detail'] as const,
};
```

2. Create `features/profile/hooks/use-profile.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/libs/api-client';
import { profileQueryKeys } from '../collections/queryKeys';

export type Profile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  loyaltyPointsBalance: number;
};

export function useProfile() {
  const api = useApiClient();
  return useQuery({
    queryKey: profileQueryKeys.detail(),
    queryFn: () => api.get<Profile>('/me/profile'),
    staleTime: 0,    // always refetch on mount — balance changes after cancel/return
  });
}
```

3. Wire `profileQueryKeys.detail()` in the push notification handler (see [02-push-integration.md](02-push-integration.md)). Remove the `// TODO(Phase M1)` comment block.

---

## Phase M2 — Order detail loyalty fields

**Depends on**: nothing (can ship in parallel with M1).

### NestJS change

Extend the `GET /2026-01/fo-mobile/stores/:storeId/orders/:orderId` response to include loyalty counters from the FO order row:

```ts
// Additional fields in the order detail response:
loyaltyPointsUsed: number;       // points spent at checkout
loyaltyPointsEarned: number;     // points earned at delivery (0 until delivered)
loyaltyPointsRestored: number;   // cumulative points restored by cancel/return
```

### Mobile changes

Update `OrderDetail` type in `features/orders/hooks/use-order-detail.ts`:

```ts
export type OrderDetail = {
  id: string;
  storeId: string;
  orderNo: string;
  status: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
  // Loyalty (Phase M2)
  loyaltyPointsUsed: number;
  loyaltyPointsEarned: number;
  loyaltyPointsRestored: number;
};
```

Add a loyalty panel to the order detail screen when any field is non-zero:

```tsx
{(order.loyaltyPointsUsed > 0 || order.loyaltyPointsRestored > 0 || order.loyaltyPointsEarned > 0) && (
  <LoyaltyPanel
    used={order.loyaltyPointsUsed}
    earned={order.loyaltyPointsEarned}
    restored={order.loyaltyPointsRestored}
  />
)}
```

---

## Phase M3 — Push handler wiring

**Depends on**: Phase M1 (`profileQueryKeys` must be defined before merging).

The handler structure is already documented in [02-push-integration.md](02-push-integration.md). This phase is just removing the TODO guard and ensuring:

- Both `addNotificationResponseReceivedListener` (background/killed) and `addNotificationReceivedListener` (foreground) are registered in `app/_layout.tsx`.
- `profileQueryKeys.detail()` is imported from `features/profile/collections/queryKeys.ts`.
- The foreground in-app toast shows `+N điểm hoàn trả` when `loyaltyPointsRestored > 0`.

---

## Phase M4 — Checkout points redemption

**Depends on**: Phase M1 (balance must be fetchable before UI can show it).

### NestJS change

`POST /2026-01/fo-mobile/stores/:storeId/orders` must accept `loyaltyPointsUsed?: number` in the request body. NestJS validates: `0 ≤ loyaltyPointsUsed ≤ min(profile.loyaltyPointsBalance, orderTotal)`.

### Mobile changes

1. Show current balance in the checkout review screen: `"Điểm tích lũy: N điểm"`.
2. Add a collapsible "Dùng điểm" section with a stepper or text input capped at `min(profile.loyaltyPointsBalance, orderTotal)`.
3. Include `loyaltyPointsUsed` in the order payload from `use-place-order.ts`.

---

## Phase M5 — Earning display

**Depends on**: Phase M2 (order detail loyalty fields) + BO Wave 2 landing.

Once BO ships the `order_status_changed` webhook, earning fires on the FO web server when an order is delivered. The order detail response will then carry a non-zero `loyaltyPointsEarned`. Phase M2 already handles the display — no additional API or handler work needed.

The profile balance refetch on mount will reflect the earned points without any push notification (earning is FO-local; BO does not push for earning). Users discover the credit by opening the app after delivery.

---

## Dependency table

| Phase | Blocked on | Effort estimate |
| --- | --- | --- |
| M1 — Profile balance fetch | NestJS fo-mobile `me/profile` endpoint | S |
| M2 — Order detail loyalty fields | NestJS order detail response update | S |
| M3 — Push handler wiring | Phase M1 (`profileQueryKeys`) | XS |
| M4 — Checkout redemption | Phase M1 + NestJS order create `loyaltyPointsUsed` | M |
| M5 — Earning display | Phase M2 + BO Wave 2 | XS (display only, M2 handles it) |

## NestJS work required (BO repo: `apps/api/src/modules/fo-mobile/`)

| Endpoint / change | File | Phase |
| --- | --- | --- |
| `GET /2026-01/me/profile` → returns `loyaltyPointsBalance` | `fo-mobile/me/fo-mobile-me.controller.ts` | M1 |
| Order detail response includes loyalty counter fields | `fo-mobile/orders/fo-mobile-orders.controller.ts` | M2 |
| Order create accepts `loyaltyPointsUsed?: number` | `fo-mobile/orders/fo-mobile-orders.service.ts` | M4 |

## Recommended shipping order

```
M2 (no deps)
M1 → M3 (unblocks push handler)
M1 → M4 (unblocks checkout redemption)
M2 + BO Wave 2 → M5 (earning display, last)
```

M2 and M1 can be developed in parallel. M3 and M4 gate on M1 landing first.
