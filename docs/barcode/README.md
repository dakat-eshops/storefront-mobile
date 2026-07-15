# Barcode Feature — FO Mobile (storefront-mobile)

FO mobile implementation of product barcodes. **Cross-repo SSOT lives in the BO**: [BO docs/barcode/02-barcode-schema.md](../../../../BO/e-Shops/docs/commerce/barcode/02-barcode-schema.md). Any change to the URL shape or resolver contract requires a coordinated update in all three repos before deployment.

## What's shipped

| Area | Status | File |
|------|--------|------|
| `barcode` in `ProductDetail` + variation sub-type | ✅ Shipped | [features/products/types.ts](../../features/products/types.ts) |
| `ProductBarcode` component (1D + QR) | ✅ Shipped | [features/products/components/product-barcode.tsx](../../features/products/components/product-barcode.tsx) |
| PDP barcode (variation-aware) | ✅ Shipped | [app/product/[id].tsx](../../app/product/%5Bid%5D.tsx) |
| `EXPO_PUBLIC_FO_WEB_URL` env var | ✅ Shipped | [libs/env.ts](../../libs/env.ts) — `env.foWebUrl` |
| In-app 1D barcode scanner | ⏳ Phase 2 | — |

## How it works

The `barcode` column is returned by the NestJS FO endpoint via the full `ProductRow` spread. No API changes were required.

### Variation precedence rule

| Product state | Barcode shown |
|---------------|---------------|
| No variations | `product.barcode` |
| Has variations | `defaultVariation.barcode` → falls back to `product.barcode` |

```tsx
// app/product/[id].tsx — variation-aware resolve
data.variations?.find((v) => v.isDefault)?.barcode ?? data.barcode
```

### QR URL

Built from `env.foWebUrl` (the `EXPO_PUBLIC_FO_WEB_URL` env var):

```
${env.foWebUrl}/products/${data.slug}
```

Set `EXPO_PUBLIC_FO_WEB_URL=https://your-store.example.com` in `.env` (and `.env.local` for development). Falls back to `''` which produces a relative-ish URL — for local development this still renders the QR but the link won't resolve off-device.

## Package choices

| Concern | Package | Why |
|---------|---------|-----|
| 1D barcode render | `react-native-barcode-svg` | SVG-based, zero native code, Expo-compatible |
| QR render | `react-native-qrcode-svg` | Already in the codebase (order-QR) — reused |

## Format auto-selection

| Input length / pattern | Format |
|------------------------|--------|
| 13 digits | EAN13 |
| 12 digits | UPCA |
| 8 digits | EAN8 |
| 14 digits | ITF14 |
| Anything else | CODE128 |

Implemented in `barcodeFormatFor()` inside `product-barcode.tsx` — mirrors `barcodeFormatFor()` in `@eshops/db/barcodeUtils.ts`.

## Scanner contrast

Always `backgroundColor="white"` + `color="#000000"` on both `Barcode` and `QRCode` components — immune to dark mode. This is a scanner-contrast hard rule: every barcode/QR rendered in this app must use explicit white background + black foreground.

## Phase 2: in-app scanner

When the app needs a "scan a product barcode to open it" feature:

1. Use `expo-camera` + `@zxing/browser` (or a native decoder via Expo module) to decode 1D barcodes.
2. Call `GET /2026-01/fo/stores/:storeId/products/resolve-barcode/:barcode` (HMAC-guarded — not yet built in NestJS).
3. Navigate to `/product/${id}` with the resolved product ID.

See [BO docs/barcode/05-fo-integration.md](../../../../BO/e-Shops/docs/commerce/barcode/05-fo-integration.md) for the full resolver flow.
