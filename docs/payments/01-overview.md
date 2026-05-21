# 01 · Payment Methods Overview

## Vietnamese market context

| Method | Popularity | Notes |
| --- | --- | --- |
| COD (Cash on Delivery) | Very high | Default; requires no payment gateway |
| Bank Transfer (VietQR) | High | In-app QR; supported by all Vietnamese banks |
| MoMo | High | Vietnam's most-installed e-wallet; requires app-switch |
| ZaloPay | Medium | Popular with Zalo users; requires app-switch |
| VNPay | Medium | Widely accepted; app-switch + QR support |

COD MUST be the default selected method and MUST appear first in the list. This is a product requirement for the Vietnamese market, not just a preference.

## Mobile-specific constraints

- **No HMAC secret in binary.** The web FO uses `BO_WEBHOOK_SECRET` in a Next.js server action. Mobile cannot do this. All payment creation goes through the `/fo-mobile/` gateway authenticated by Clerk JWT + device attestation. See [04-mobile-flow.md](04-mobile-flow.md).
- **App-switch for wallets.** MoMo, ZaloPay, and VNPay require opening the external app. The mobile app must handle foreground resume and check order payment status on return.
- **QR-only fallback.** For users without a wallet app installed, offer VietQR as a fallback — any Vietnamese banking app can scan it.

## Payment method config (from BO API)

The store's available payment methods are configured in the BO by `payment_methods` records. The FO fetches them at app start and stores them via TanStack Query:

```ts
// features/checkout/hooks/use-payment-methods.ts
export function usePaymentMethods() {
  const api = useApiClient();

  return useQuery({
    queryKey: checkoutQueryKeys.paymentMethods(storeId),
    queryFn: ({ signal }) =>
      api.get<PaymentMethod[]>(`/payment-methods`, signal),
    staleTime: 1000 * 60 * 60,   // 1 hour — payment config is low-change
  });
}
```

## Integration decision matrix

| Condition | Use |
| --- | --- |
| Method = COD or bank_transfer | Skip gateway; create order directly |
| Method = momo, zalopay, vnpay — app installed | App-switch via deep link |
| Method = momo, zalopay, vnpay — app NOT installed | VietQR fallback or in-app WebView |
| Method = vietqr | In-app QR + polling |
