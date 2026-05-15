# 04 · Review & Confirm

The review screen is the last step before order creation. It shows a full order summary and exposes the "Place Order" button.

## What to show

- Cart line items (product name, variant, qty, unit price, subtotal)
- Shipping address (recipient, phone, full address string)
- Shipping method + estimated delivery range
- Payment method
- Price breakdown: subtotal, shipping fee, discount/coupon, loyalty points used, grand total
- "Place Order" (Đặt hàng) button

## Read-only state

The review screen is intentionally read-only. The user cannot edit anything here — they must go back to the relevant screen to change it. This prevents ambiguous state between what the user sees and what gets submitted.

Provide clear "Edit" links that navigate back:

```tsx
<Section title="Địa chỉ giao hàng">
  <AddressSummary address={shippingAddress} />
  <TextLink onPress={() => router.push('/checkout/shipping')}>Thay đổi</TextLink>
</Section>

<Section title="Thanh toán">
  <PaymentMethodSummary method={paymentMethod} />
  <TextLink onPress={() => router.push('/checkout/payment')}>Thay đổi</TextLink>
</Section>
```

## Order summary calculation

The grand total shown on the review screen MUST match the server-side calculation exactly. Pre-fetch a price quote before showing the review screen:

```ts
// Fetch a confirmed price quote; server re-validates coupon validity, loyalty balance, etc.
const api = useApiClient();
const { data: quote } = useQuery({
  queryKey: checkoutQueryKeys.quote({ cartId, couponCode, loyaltyPointsToUse }),
  queryFn: () =>
    api.post('/checkout/quote', {
      cartId,
      couponCode,
      loyaltyPointsToUse,
    }),
  staleTime: 0,    // always fresh on the review screen
});
```

## Placing the order

```tsx
const placeOrder = usePlaceOrder();   // see checkout/01-flow.md

<Button
  loading={placeOrder.isPending}
  disabled={placeOrder.isPending}
  onPress={() => placeOrder.mutate()}
  style={styles.placeOrderButton}
>
  Đặt hàng
</Button>
```

The button MUST be disabled while the mutation is in-flight to prevent double-submission.

## Post-submission routing

| Outcome | Navigation |
| --- | --- |
| COD success | `router.replace('/orders/:orderId')` |
| Bank transfer / VietQR | `router.replace('/orders/:orderId')` (QR polling happens on order detail) |
| MoMo / ZaloPay / VNPay | App-switch to wallet; on return: `router.replace('/checkout/payment-callback')` which auto-resolves to `/orders/:orderId` |
| Error | Stay on review screen; show error toast; allow retry |

## Loading state

Show a full-screen loader (not just a button spinner) while the payment intent is being processed. This prevents the user from navigating away mid-mutation:

```tsx
{placeOrder.isPending && (
  <LoadingOverlay message="Đang xử lý đơn hàng..." />
)}
```

## Success / Thank You

After routing to `/orders/:orderId`, the order detail screen serves as the "thank you" page. Show order status prominently at the top and include the estimated delivery date.
