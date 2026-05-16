import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/libs/api-client';
import { orderQueryKeys } from '../collections/queryKeys';

export type { orderQueryKeys };

export type OrderItem = {
  id: string;
  itemName: string;
  itemId: string;
  quantity: number;
  price: number;
  imageUrl?: string | null;
};

export type CancelRequest = {
  id: string;
  status: 'pending_review' | 'approved' | 'rejected';
  reason: string;
  note?: string;
  createdAt: string;
};

export type ReturnRequest = {
  id: string;
  status:
    | 'pending_review'
    | 'approved'
    | 'items_received'
    | 'inspected'
    | 'refund_issued'
    | 'rejected';
  reason: string;
  refundAmount?: number;
  loyaltyPointsRestored?: number;
  createdAt: string;
};

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'return_requested'
  | 'returned';

export type OrderDetail = {
  id: string;
  storeId: string;
  orderNo: string;
  status: OrderStatus;
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  createdAt: string;
  deliveredAt?: string | null;
  orderItems: OrderItem[];
  cancelRequest?: CancelRequest | null;
  returnRequest?: ReturnRequest | null;
  loyaltyPointsUsed?: number;
  loyaltyPointsRestored?: number;
  loyaltyPointsEarned?: number;
};

export function useOrderDetail(orderId: string | undefined) {
  const api = useApiClient();
  return useQuery({
    queryKey: orderQueryKeys.detail(orderId ?? ''),
    queryFn: ({ signal }) => api.get<OrderDetail>(`/orders/${orderId}`, signal),
    enabled: !!orderId,
    staleTime: 1000 * 60, // 1 min — status may change
  });
}
