# 01 · Checkout Flow

## State machine

The checkout progresses through four screens in order. Each screen validates its own required state before allowing navigation forward.

```text
Cart screen
   │
   ├─ (not signed in) → /sign-in → return to checkout
   │
   ▼
/checkout/shipping       ← required: profileId, cartId
   │  address selected / confirmed
   ▼
/checkout/payment        ← required: shippingAddressId
   │  payment method selected
   ▼
/checkout/review         ← required: shippingAddressId + paymentMethod
   │  "Place Order" tapped
   ▼
POST /fo-mobile/stores/:storeId/checkout/payment-intent
   │
   ├─ COD / bank_transfer →  /orders/:orderId   (success screen)
   ├─ MoMo / ZaloPay / VNPay → external app-switch → /checkout/payment-callback → /orders/:orderId
   └─ VietQR → in-app QR polling → /orders/:orderId
```

## Checkout context

Maintain checkout state in a Zustand store (not TanStack DB — no syncing needed, it's transient per session):

```ts
// features/checkout/store.ts
import { create } from 'zustand';

interface CheckoutState {
  cartId: string | null;
  shippingAddressId: string | null;
  paymentMethod: PaymentMethod | null;

  setCartId: (id: string) => void;
  setShippingAddressId: (id: string) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  reset: () => void;
}

export const useCheckoutStore = create<CheckoutState>((set) => ({
  cartId: null,
  shippingAddressId: null,
  paymentMethod: null,

  setCartId: (id) => set({ cartId: id }),
  setShippingAddressId: (id) => set({ shippingAddressId: id }),
  setPaymentMethod: (method) => set({ paymentMethod: method }),
  reset: () => set({ cartId: null, shippingAddressId: null, paymentMethod: null }),
}));
```

Call `reset()` after a successful order creation and also in a `useEffect` cleanup if the user navigates away without completing checkout.

## Navigation guards

Each checkout screen must validate its required state:

```ts
// app/checkout/payment.tsx
export default function PaymentScreen() {
  const { shippingAddressId } = useCheckoutStore();

  // Guard: must have a shipping address before picking payment
  useEffect(() => {
    if (!shippingAddressId) {
      router.replace('/checkout/shipping');
    }
  }, [shippingAddressId]);

  // ... screen UI
}
```

## "Place Order" mutation

```ts
// features/checkout/hooks/use-place-order.ts
import { useMutation } from '@tanstack/react-query';
import { useCheckoutStore } from '../store';
import { api } from '@/libs/api-client';
import type { PaymentIntentResult } from '@eshops/api-contracts';

export function usePlaceOrder() {
  const { cartId, shippingAddressId, paymentMethod, reset } = useCheckoutStore();

  return useMutation<PaymentIntentResult, ApiError>({
    retry: 0,   // never retry payment mutations — double-submit risk
    mutationFn: () =>
      api.post<PaymentIntentResult>(`/fo-mobile/stores/${STORE_ID}/checkout/payment-intent`, {
        cartId,
        shippingAddressId,
        paymentMethod: paymentMethod?.key,
      }),
    onSuccess: (result) => {
      // Invalidate cart so it empties
      queryClient.invalidateQueries({ queryKey: cartQueryKeys.all() });
      // Handle by payment type — see payments/04-mobile-flow.md
      handlePaymentResult(result);
    },
    onError: (err) => {
      // Do NOT reset checkout state on error — user may want to change method and retry
    },
  });
}
```

## Back navigation

The checkout screens use a stack navigator. The "back" button should:

- From review → return to payment (don't cancel the order — no order exists yet at review)
- From payment → return to shipping
- From shipping → return to cart

Once `POST /payment-intent` succeeds, **replace** the history entry to prevent "back" from submitting again:

```ts
router.replace(`/orders/${orderId}`);   // replace, not push
```

## Error recovery

| Error | What to show | Action |
| --- | --- | --- |
| 409 Inventory conflict | "Some items are out of stock" + list | Return to cart, remove items |
| 422 Coupon expired | "Coupon is no longer valid" | Remove coupon, retry |
| 422 Loyalty points insufficient | "Not enough points" | Reduce points or remove, retry |
| 500 Gateway error | "Payment failed — please try again" | Allow retry on same screen |
| Network timeout | Offline banner | `retry: 0` — do NOT auto-retry payment |

For network timeouts: check order status before allowing retry. If an order was created (status = pending), navigate to it instead of creating a second order.
