import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/libs/api-client';
import { generateId } from '@/libs/generate-id';
import { orderQueryKeys } from '@/features/orders/collections/queryKeys';

export function useCancelOrder(orderId: string) {
  const queryClient = useQueryClient();
  const api = useApiClient();

  return useMutation({
    mutationFn: ({ reason, note }: { reason: string; note?: string }) =>
      api.post('/cancel-requests', {
        orderId,
        reason,
        note,
        foRequestId: generateId(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(orderId) });
    },
    retry: 0,
  });
}
