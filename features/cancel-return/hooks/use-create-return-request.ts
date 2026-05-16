import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/libs/api-client';
import { generateId } from '@/libs/generate-id';
import { env } from '@/libs/env';
import { orderQueryKeys } from '@/features/orders/collections/queryKeys';

export type ReturnItemInput = {
  orderItemId: string;
  quantity: number;
};

export type ReturnRequestInput = {
  selectedItems: ReturnItemInput[];
  reason: string;
  note?: string;
  evidenceUris: string[];
};

async function uploadEvidencePhotos(uris: string[]): Promise<string[]> {
  return Promise.all(
    uris.map(async (uri) => {
      const formData = new FormData();
      formData.append('file', { uri, name: 'evidence.jpg', type: 'image/jpeg' } as unknown as Blob);
      const res = await fetch(
        `${env.apiBaseUrl}/${env.apiVersion}/fo-mobile/stores/${env.defaultStoreId}/media/upload`,
        {
          method: 'POST',
          body: formData,
          // Do NOT set Content-Type — fetch sets multipart/form-data with boundary automatically
        },
      );
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const json = (await res.json()) as { url: string };
      return json.url;
    }),
  );
}

export function useCreateReturnRequest(orderId: string) {
  const queryClient = useQueryClient();
  const api = useApiClient();

  return useMutation({
    mutationFn: async (data: ReturnRequestInput) => {
      const evidenceUrls =
        data.evidenceUris.length > 0 ? await uploadEvidencePhotos(data.evidenceUris) : [];

      return api.post('/return-requests', {
        orderId,
        items: data.selectedItems,
        reason: data.reason,
        note: data.note,
        evidenceUrls,
        foRequestId: generateId(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(orderId) });
    },
    retry: 0,
  });
}
