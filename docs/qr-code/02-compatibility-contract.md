# QR Code — Compatibility Contract

> Mirror of `BO/e-Shops/docs/qr-code/02-qr-payload-schema.md`.
> The BO doc is the SSOT. If they diverge, the BO doc wins.

## Payload shape (v: 1)

```ts
type QrPayload = { v: 1; s: string; o: string; r: string };
```

```json
{
  "v": 1,
  "s": "018f1234-5678-7abc-def0-123456789abc",
  "o": "018f9876-5432-7fed-cba0-987654321abc",
  "r": "ORD-0042"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `v` | `number` | Schema version. Always `1` until bumped. |
| `s` | `string` (UUID) | `storeId` — BO validates this against the session. **Required.** |
| `o` | `string` (UUID) | `orderId` — used for BO router navigation. |
| `r` | `string` | Order display number e.g. `"ORD-0042"` — shown in scanner UI before navigation. |

## Encoder (copy verbatim into `libs/qr.ts`)

```ts
type QrPayload = { v: 1; s: string; o: string; r: string };

export function buildOrderQrPayload(
  storeId: string,
  orderId: string,
  orderNumber: string,
): string {
  const payload: QrPayload = { v: 1, s: storeId, o: orderId, r: orderNumber };
  return JSON.stringify(payload);
}
```

## Versioning

- **Bump `v`** before adding or removing any field — coordinated PR in BO + KhanhStore + storefront-mobile simultaneously.
- **Backward compat window**: BO supports `v-1` for 30 days after all three repos deploy `v`. After zero-error window, old branch is removed.
- Never rename fields or change types without bumping `v`.

## What must never be in the payload

`profileId`, customer name, phone, email, payment info, JWT, session tokens.
