export type WishlistItem = {
  productId: string;
  slug?: string | null;
  name: string;
  imageUrl?: string | null;
  unitPrice?: number | null;
  currency?: string | null;
  addedAt: string;
};
