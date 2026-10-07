# Checkout — Mobile FO

Full checkout flow: cart → shipping address → payment method → review → confirm.

## Documents

| File | Topic |
| --- | --- |
| [01-flow.md](01-flow.md) | Screen-by-screen checkout flow, state machine, navigation |
| [02-shipping-address.md](02-shipping-address.md) | Address form, province/district/ward picker, Vietnamese address format |
| [03-payment.md](03-payment.md) | Payment method selection and gateway integration |
| [04-review-confirm.md](04-review-confirm.md) | Order summary screen, confirm mutation, success/failure handling |
| [05-delivery-options.md](05-delivery-options.md) | Giao thường / Hoả tốc {x}h picker — ⏳ blocked on mobile checkout; contract + the BO endpoints it needs |

## Key invariants

1. **Checkout requires authentication.** No guest checkout on mobile — Clerk session is mandatory. Redirect to `/sign-in` if no session.
2. **COD is the default payment method.** Pre-select it on the payment screen; never default to an online method.
3. **The checkout state must survive backgrounding.** Users are sent to external payment apps (MoMo etc.) and return. Use Expo Router's persistent state + `AppState` listener to resume correctly.
4. **Province → District → Ward is a strict cascade.** Changing province resets both district and ward. Changing district resets ward. Never pre-fill ward without a district or district without a province.
5. **Payment intent is created ONCE and is the order creation step.** There is no separate "create order" then "pay" flow — `POST /checkout/payment-intent` atomically creates the order record and returns the gateway redirect.

## Screen map

```text
/checkout/shipping   →  shipping address form (province/district/ward)
/checkout/payment    →  payment method selector
/checkout/review     →  order summary + confirm button
/checkout/payment-callback  →  transient deep-link return screen (MoMo/ZaloPay/VNPay)
```

## Cross-references

- [../payments/04-mobile-flow.md](../payments/04-mobile-flow.md) — Payment intent creation, gateway flows
- [../_initial/07-navigation-deep-linking.md](../_initial/07-navigation-deep-linking.md) — Deep link config
- [../_initial/03-authentication.md](../_initial/03-authentication.md) — Clerk session guard
