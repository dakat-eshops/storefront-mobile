# QR Code — storefront-mobile

Staff in the BO scan a QR code shown on the customer's order screen to instantly navigate to that order — no search, no typing.

This repo owns the **QR display** side only. The BO owns the scanner.

## Cross-repo SSOT

**Payload schema** is defined and versioned in the BO repo:
`BO/e-Shops/docs/qr-code/02-qr-payload-schema.md`

Never change the payload shape here without a coordinated PR in the BO repo first.

## Contents

- [01-implementation.md](01-implementation.md) — `react-native-qrcode-svg` setup, component, `expo-keep-awake`, usage
- [02-compatibility-contract.md](02-compatibility-contract.md) — payload schema mirror + cross-repo rules

## Package

| Package | Version | Why |
|---------|---------|-----|
| `react-native-qrcode-svg` | latest | Expo-managed compatible, uses `react-native-svg` already in stack, SVG output = crisp on all densities |

## Hard rules

1. **Payload must match the BO SSOT** — field names, types, and `v` version. Copy `buildOrderQrPayload` verbatim from `02-compatibility-contract.md`.
2. **Always white background** — `backgroundColor="#ffffff"` + `color="#09090b"` regardless of device theme. QR scanners need high contrast.
3. **No PII in payload** — `orderId` (UUID) + `storeId` + `orderNumber` only. Never add `profileId`, name, phone, or address.
4. **`storeId` in payload is mandatory** — the BO scanner rejects QR codes without a matching `storeId`. Do not omit it.
5. **Use `expo-keep-awake`** — prevent screen dimming while the QR is visible. The hook is in [01-implementation.md](01-implementation.md).

## Prop difference vs KhanhStore (web)

| Concern | react-qr-code (KhanhStore) | react-native-qrcode-svg (this repo) |
|---------|---------------------------|--------------------------------------|
| Error correction | `level="M"` | `ecl="M"` |
| Foreground color | `fgColor="#09090b"` | `color="#09090b"` |
| Background color | `bgColor="#ffffff"` | `backgroundColor="#ffffff"` |
| Screen keep-awake | Screen Wake Lock API | `expo-keep-awake` |
