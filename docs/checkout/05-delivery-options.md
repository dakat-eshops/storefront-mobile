# 05 · Delivery Options (Giao thường / Hoả tốc {x}h)

**Status: ⏳ blocked on mobile checkout (2026-10-07).** Web FO and BO shipped this on 2026-10-06, dark behind `shipping.deliveryOptionsEnabled`. Mobile has no checkout yet: there are no `/checkout/*` screens and no `fo-mobile` checkout or shipping endpoints in BO. `usePlaceOrder` posts to a route that doesn't exist yet. Build this **as part of** the shipping and review screens, not as a separate feature.

**Canonical docs:** BO `docs/commerce/shipping/delivery-options/` (design and contract). Web FO `docs/commerce/shipping/04-delivery-options.md` (reference implementation: `use-delivery-options.ts`, `delivery-option-picker.tsx`, `libs/delivery-options.ts`; port the pure lib as-is).

## What the customer sees

A **delivery** customer picks how fast the order travels, e.g. **Giao thường** (1–3 days) or **Hoả tốc 4h** (inner city, before a cutoff). Each option is a BO `shipment_methods` row bound to a carrier tier. The app shows name, ETA and fee, and sends back the chosen `shipmentMethodId`. BO re-prices it at checkout.

## Where it goes in this flow

| Screen | Change |
| --- | --- |
| `/checkout/shipping` | After an address is chosen: a "Phương thức giao hàng" summary row plus a bottom sheet (draft selection, committed on "Xác nhận"). Shown only when the toggle is ON and there are **≥ 2** options. Unavailable options stay visible, greyed, with their reason. |
| `/checkout/review` | "Shipping method + estimated delivery" shows the chosen option. The fee row reads "Phí vận chuyển (Hoả tốc 4h)" for a non-default option. |
| `useCheckoutStore` | `shipmentMethodId: string \| null`. Reset with the rest of the store; clear it when the address changes, so the default is reselected after re-fetch. |
| Place order | Send `shipment.shipmentMethodId` for delivery only. Omit it when the toggle is OFF. |

## Contract (identical to web)

- Toggle: `shipping.deliveryOptionsEnabled` (site preference, `fo-public`, default `false`). Treat a missing or failed read as OFF.
- Options: BO `options-by-text` returns `{ options: DeliveryOption[] }` (at most 4). Each option has `shipmentMethodId`, `name`, `estimatedDelivery`, `promiseHours`, `estimatedDeliveryDays`, `totalFeeVnd | null`, `available`, `unavailableReason` (`past_cutoff` | `out_of_service_area` | `provider_unavailable`), and `isDefault`. Exactly one option is the default, and it is always available. `[]` means fall back to the single-fee quote.
- **Label rule:** if `promiseHours != null`, show "Hoả tốc {x}h" / "Nhận trong {x} giờ"; otherwise show `name` / `estimatedDelivery`. This keeps the label in step with the deadline the BO order table counts down to.
- **Selection rule:** use the stored id if it is offered and available, otherwise the default. In "Hẹn giờ" mode, only the default applies.
- Checkout `422 SHIPPING_METHOD_INVALID` / `SHIPPING_METHOD_UNAVAILABLE`: clear the choice, re-fetch the options, show the message. Never auto-resubmit.
- Never show a carrier name. Never send a fee.
- Re-fetch the options when the sheet opens, because a cutoff may have passed while the screen was open.

## BO work this needs (when mobile checkout is built)

The web FO reaches `options-by-text` through an HMAC-signed Next.js proxy, so mobile can't call it directly. The `fo-mobile` module needs:

- a Clerk-authenticated `POST …/fo-mobile/stores/:storeId/shipping/options` that delegates to `ShipmentsService.getFoTextOptions()`, using the address of the profile's `shippingAddressId`;
- its checkout to accept `shipment.shipmentMethodId` and reuse `FoCheckoutDbService`'s `resolveChosenDeliveryOption()`, so web and mobile share one validation and pricing path.

Quotes are cached in Redis for 60 s per store, carrier tier and address, so a mobile caller gets the same fee that checkout will charge.
