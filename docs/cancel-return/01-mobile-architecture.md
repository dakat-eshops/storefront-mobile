# 01 · Mobile Architecture for Cancel & Return

## How mobile differs from web FO

| Concern | Web FO (Next.js) | Mobile (Expo) |
| --- | --- | --- |
| Request signing to NestJS | HMAC with `BO_WEBHOOK_SECRET` in server action | Clerk JWT + DeviceAttestation (no HMAC) |
| Receiving BO decision | BO calls `/api/webhooks/bo/order-status` on the FO server | BO sends push notification; mobile fetches updated order |
| Auth guard on NestJS `/fo-mobile/` | `ClerkMobileGuard` + `DeviceAttestationGuard` | Same |
| Cancel/return auto-approve | `CancelReturnPolicyService.shouldAutoApprove()` in NestJS | Same — NestJS handles, mobile just observes result |

## BO → Mobile notification flow

```text
BO admin approves/rejects cancel request
           │
           ▼
NestJS CancelRequestsService.update()
  → CacheService.revalidate(...)
  → FoNotificationService.sendPush(profileId, {
      title: 'Yêu cầu hủy đã được xử lý',
      body: 'Đơn hàng #0012 đã được hủy thành công',
      data: { type: 'cancel_status_update', orderId: '...', status: 'approved' }
    })
           │
           ▼
Expo Push Service → device
           │
           ▼
App receives notification
  → invalidates orderQueryKeys.detail(orderId)
  → user navigates to /orders/:orderId (or auto-navigates if foregrounded)
```

There is no webhook from BO to mobile. The push notification is the only mechanism.

## NestJS controller (mobile variant)

Mobile cancel/return requests go to `/fo-mobile/` routes, not `/fo/` routes. The mobile controller:

- Uses `@UseGuards(ClerkMobileGuard, DeviceAttestationGuard)` (no `HmacGuard`)
- Requires `@Public()` to bypass the global `ApiKeyGuard`
- Same request body shape as the web FO controller (so the same NestJS service can be reused)

```ts
// apps/api/src/modules/fo-mobile/cancel-requests/fo-mobile-cancel-requests.controller.ts
@Controller({ version: '2026-01', path: 'fo-mobile/stores/:storeId/cancel-requests' })
@Public()                         // bypass global ApiKeyGuard
@UseGuards(ClerkMobileGuard, DeviceAttestationGuard)
export class FoMobileCancelRequestsController {
  constructor(private readonly cancelRequestsService: FoCancelRequestsService) {}

  @Post()
  create(
    @Param('storeId') storeId: string,
    @Body() dto: CreateCancelRequestDto,
    @ClerkProfile() profile: ClerkProfilePayload,
  ) {
    return this.cancelRequestsService.create(storeId, profile.profileId, dto);
  }
}
```

The shared `FoCancelRequestsService` is used by both `/fo/` and `/fo-mobile/` controllers.

## Idempotency

Mobile users may tap "Cancel" multiple times due to slow networks. The NestJS service MUST handle idempotent submissions:

- If a cancel request already exists for the order with the same `profileId`, return the existing request (HTTP 200) instead of creating a duplicate.
- Use `foRequestId` generated client-side (UUID) as the idempotency key. Send it in the request body. NestJS upserts on `(orderId, foRequestId)`.
