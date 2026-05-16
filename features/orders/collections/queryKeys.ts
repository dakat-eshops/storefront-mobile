/**
 * Single source of truth for order query keys.
 * ALWAYS import from here — never hardcode ['orders', ...] inline.
 */
export const orderQueryKeys = {
  all: ['orders'] as const,
  lists: () => [...orderQueryKeys.all, 'list'] as const,
  list: (params: { limit?: number; offset?: number } = {}) =>
    [...orderQueryKeys.lists(), params] as const,
  details: () => [...orderQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderQueryKeys.details(), id] as const,
};
