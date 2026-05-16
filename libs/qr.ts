// Shape must match BO/e-Shops/docs/qr-code/02-qr-payload-schema.md
type QrPayload = { v: 1; s: string; o: string; r: string };

export function buildOrderQrPayload(
  storeId: string,
  orderId: string,
  orderNumber: string,
): string {
  const payload: QrPayload = { v: 1, s: storeId, o: orderId, r: orderNumber };
  return JSON.stringify(payload);
}
