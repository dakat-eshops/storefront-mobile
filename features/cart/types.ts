/**
 * Local cart row. Same shape as the FO web `CartStorageItem` for sync parity
 * (see KhanhStore web `features/cart/types/index.ts`).
 *
 * `itemId` is the primary key — usually `productId` for non-variation items,
 * or `productId:variationId` for variations.
 */
export type CartStorageItem = {
  itemId: string;
  productId: string;
  variationId?: string | null;
  name: string;
  imageUrl?: string | null;
  unitPrice: number;
  currency: string;
  qty: number;
  addedAt?: string;
};
