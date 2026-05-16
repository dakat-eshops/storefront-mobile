/**
 * Wire shape mirror for `/fo-mobile/.../orders`. The authoritative type lives
 * in `@eshops/db` (server side); we mirror only what the mobile UI reads.
 */
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned'
  | 'partially_cancelled'
  | 'partially_refunded';

export type OrderListItem = {
  id: string;
  orderNumber?: string | null;
  status: OrderStatus | string;
  total: number | string;
  currency?: string | null;
  itemCount?: number | null;
  placedAt?: string | null;
};

export type OrderListResponse = {
  items: OrderListItem[];
  total?: number;
  nextOffset?: number | null;
};
