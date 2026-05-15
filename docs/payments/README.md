# Payments — Mobile FO

Payment integration for FO mobile checkout. **Read this before implementing checkout.**

The mobile payment flow differs fundamentally from the web FO: there is no server-side HMAC signing available in the binary, so all payment intent creation goes through the `/fo-mobile/` mobile gateway (Clerk JWT + device attestation, no HMAC).

## Documents

| File | Topic |
| --- | --- |
| [01-overview.md](01-overview.md) | Payment method support, Vietnamese market context, decision matrix |
| [02-payment-intent.md](02-payment-intent.md) | Payment intent creation, NestJS endpoint, mobile-gateway flow |
| [03-native-sdks.md](03-native-sdks.md) | MoMo, ZaloPay, VNPay, VietQR — deep-link + app-switch patterns |
| [04-mobile-flow.md](04-mobile-flow.md) | **End-to-end mobile payment flow** (read this before checkout) |

## Quick rules

1. **Never bundle `FO_HMAC_SECRET` in the binary.** Mobile payment intents are created via `/fo-mobile/` using Clerk JWT + device attestation only.
2. **COD is always available and MUST be the default.** Vietnamese e-commerce: COD is the most common method; place it first.
3. **App-switch payments (MoMo, ZaloPay, VNPay) use deep links to return to the app.** Configure `khanhstore://checkout/payment-callback` in the deep-link scheme.
4. **QR payments (VietQR) show an in-app QR image.** No app-switch; poll for payment status.
5. **Never navigate away from the checkout screen without a cleanup.** If the user backgrounds the app during app-switch, the checkout must survive the foreground resume.

## Cross-references

- [_initial/04-api-client.md](../_initial/04-api-client.md) — HMAC problem + mobile gateway design
- [_initial/03-authentication.md](../_initial/03-authentication.md) — Clerk token forwarding
- [../checkout/03-payment.md](../checkout/03-payment.md) — How payment fits into the checkout screen flow
