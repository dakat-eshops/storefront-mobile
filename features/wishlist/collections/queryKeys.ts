export const wishlistQueryKeys = {
  all: ['wishlist'] as const,
  detail: () => [...wishlistQueryKeys.all, 'detail'] as const,
};
