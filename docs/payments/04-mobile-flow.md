# 04 · Mobile Payment Flow

**Read this before building checkout.** The mobile payment intent flow differs from the web FO.

## Why the flow differs from web

The web FO creates payment intents from a Next.js server action, which holds `FO_HMAC_SECRET` server-side and calls NestJS at `/fo/stores/:storeId/checkout/payment-intent` with HMAC + Clerk JWT. Mobile has no server layer — it cannot hold `FO_HMAC_SECRET` safely (binary is extractable). Instead, mobile authenticates via the `/fo-mobile/` gateway with Clerk JWT + device attestation.

```text
Web FO:
  Browser → Next.js server action (holds FO_HMAC_SECRET) → /fo/ → NestJS

Mobile:
  App → /fo-mobile/ (Clerk JWT + DeviceAttestation) → NestJS
                                  ↓ no HMAC needed
              NestJS resolves store from Clerk session claims
```

Both paths arrive at the **same NestJS payment service classes** — only the controller + guards differ.

## NestJS controller (fo-mobile/checkout)

```ts
// apps/api/src/modules/fo-mobile/checkout/fo-mobile-checkout.controller.ts
@Controller({ version: '2026-01', path: 'fo-mobile/stores/:storeId/checkout' })
@Public()                               // bypasses global ApiKeyGuard
@UseGuards(ClerkMobileGuard, DeviceAttestationGuard)
export class FoMobileCheckoutController {
  constructor(private readonly checkout: FoCheckoutService) {}

  @Post('payment-intent')
  async createPaymentIntent(
    @Param('storeId') storeId: string,
    @Body() body: CreatePaymentIntentDto,
    @Req() req: AuthedRequest,
  ) {
    return this.checkout.createPaymentIntent({
      storeId,
      profileId: req.user.profileId,    // resolved by ClerkMobileGuard
      ...body,
    });
  }
}
```

## Payment intent flow (end-to-end)

```text
1. User taps "Place Order" on the review screen
        │
2. App calls POST /fo-mobile/stores/:storeId/checkout/payment-intent
   Body: { cartId, shippingAddressId, paymentMethod: 'momo' }
   Headers: Authorization: Bearer <clerk_jwt>
            x-device-attestation: <attestation_token>
        │
3. NestJS: ClerkMobileGuard resolves req.user.profileId
           DeviceAttestationGuard verifies attestation token
           FoCheckoutService.createPaymentIntent() executes:
             a. Validates cart items + inventory
             b. Computes total with active price book
             c. Applies any active coupons
             d. Creates order record (status: 'pending')
             e. Creates payment record
             f. Returns: { orderId, paymentIntentId, deepLink?, qrUrl? }
        │
4. App receives response:
   - COD / bank transfer: navigate to order-confirmation screen
   - MoMo / ZaloPay / VNPay: open deep link (app-switch)
   - VietQR: show QR in-app, poll for status
```

## Method-specific flows

### COD (Cash on Delivery)

Simplest path — no payment gateway involved.

```ts
// After payment-intent returns for COD:
const { orderId } = await api.post('/checkout/payment-intent', { paymentMethod: 'cod', ... });
router.replace(`/orders/${orderId}`);   // navigate to confirmation
```

### MoMo app-switch

```ts
import * as Linking from 'expo-linking';
import { AppState, type AppStateStatus } from 'react-native';

async function handleMoMoPayment(deepLink: string, orderId: string) {
  // 1. Open MoMo
  const canOpen = await Linking.canOpenURL(deepLink);
  if (!canOpen) {
    // MoMo not installed — fall back to in-app WebView or VietQR
    return handleFallback(orderId);
  }
  await Linking.openURL(deepLink);

  // 2. Listen for app foreground resume — MoMo returns via deep link
  //    or user manually returns without completing
  const sub = AppState.addEventListener('change', async (state: AppStateStatus) => {
    if (state !== 'active') return;
    sub.remove();

    // 3. Poll order status — don't trust the return deep link alone
    const order = await queryClient.fetchQuery({
      queryKey: orderQueryKeys.detail(orderId),
      queryFn: () => api.get(`/orders/${orderId}`),
    });

    if (order.paymentStatus === 'paid') {
      router.replace(`/orders/${orderId}?success=1`);
    } else {
      // Show "Payment pending" — user may have abandoned
      router.replace(`/checkout/payment?orderId=${orderId}&status=pending`);
    }
  });
}
```

The return deep link from MoMo is `khanhstore://checkout/payment-callback?orderId=...&resultCode=0`. Handle it in `app/checkout/payment-callback.tsx`:

```tsx
// app/checkout/payment-callback.tsx
import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

export default function PaymentCallbackScreen() {
  const { orderId, resultCode } = useLocalSearchParams<{ orderId: string; resultCode: string }>();

  useEffect(() => {
    if (resultCode === '0') {
      router.replace(`/orders/${orderId}`);
    } else {
      router.replace(`/checkout/payment?orderId=${orderId}&status=failed`);
    }
  }, []);

  return null;  // transient screen, immediately redirects
}
```

### VietQR (in-app QR, no app-switch)

```ts
// payment-intent returns { qrUrl, orderId }
function VietQRPaymentScreen({ qrUrl, orderId }: { qrUrl: string; orderId: string }) {
  const order = useQuery({
    queryKey: orderQueryKeys.detail(orderId),
    queryFn: () => api.get(`/orders/${orderId}`),
    refetchInterval: (query) =>
      query.state.data?.paymentStatus === 'paid' ? false : 3000, // poll every 3s until paid
  });

  useEffect(() => {
    if (order.data?.paymentStatus === 'paid') {
      router.replace(`/orders/${orderId}`);
    }
  }, [order.data?.paymentStatus]);

  return (
    <View>
      <Image source={{ uri: qrUrl }} style={{ width: 240, height: 240 }} />
      <Text>Scan to pay via any banking app</Text>
      {/* countdown timer */}
    </View>
  );
}
```

## DTOs (same as web FO)

```ts
// From @eshops/api-contracts (or copy from apps/api/src/modules/fo/checkout/dto/)

interface CreatePaymentIntentDto {
  cartId: string;
  shippingAddressId: string;
  paymentMethod: 'cod' | 'bank_transfer' | 'momo' | 'zalopay' | 'vnpay' | 'vietqr';
  couponCode?: string;
  loyaltyPointsToRedeem?: number;      // whole integer only
  notes?: string;
}

interface PaymentIntentResult {
  orderId: string;
  orderNumber: string;              // human-readable (e.g. "ORD-00001")
  paymentMethod: string;
  total: number;                    // in VND (integer)
  deepLink?: string;                // MoMo / ZaloPay / VNPay
  qrUrl?: string;                   // VietQR
  expiresAt?: string;               // ISO — QR expiry or gateway timeout
}
```

## Error handling

```ts
try {
  const intent = await api.post<PaymentIntentResult>('/checkout/payment-intent', body);
  await handlePaymentMethod(intent);
} catch (err) {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 409:
        // Inventory conflict — show which items are out of stock
        showInventoryConflictModal(err.data);
        break;
      case 422:
        // Coupon expired or loyalty points insufficient
        showValidationError(err.message);
        break;
      default:
        showGenericError();
    }
  }
}
```

## Deep link configuration

Add to `app.config.ts` intentFilters / associatedDomains (already in [_initial/07-navigation-deep-linking.md](../_initial/07-navigation-deep-linking.md)) and register the callback route:

```text
app/checkout/payment-callback.tsx    →  khanhstore://checkout/payment-callback
```

## Dev / staging considerations

- MoMo sandbox returns `resultCode=0` without actually opening the MoMo app. Use the sandbox deep link from MoMo docs.
- On iOS simulator, `Linking.canOpenURL` for `momo://` returns `false`. Test app-switch only on a real device or a dev build with MoMo installed.
- VietQR QR images are test-only in sandbox — real scans will fail. Use the mock `paymentStatus` polling instead.
