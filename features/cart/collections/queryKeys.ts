/**
 * Cart query keys. Match the FO web shape so a shared `@khanhstore/data`
 * package can land cleanly.
 */
export const cartQueryKeys = {
  all: ['cart'] as const,
  detail: (scope: 'guest' | 'me') => [...cartQueryKeys.all, scope] as const,
};
