# 03 · Return Flow

## Entry point

The "Yêu cầu hoàn trả" (Request return) button appears on the order detail screen when status is `delivered` and the return window has not expired (checked client-side against `deliveredAt` + store's `returnWindowDays` from site preferences).

## Multi-step return form

Return requests are more complex than cancellations — the user must select which items to return, provide a reason, and optionally upload evidence photos.

```text
Step 1: Select items to return
         - Show each order line item with a checkbox
         - For partial returns: allow qty selector per item

Step 2: Select return reason
         - Dropdown: damaged, wrong item, quality issue, changed mind, other
         - Text field for "other"

Step 3: Upload evidence photos (optional but recommended)
         - expo-image-picker for up to 5 photos
         - Show thumbnails; allow removal

Step 4: Review and submit
```

## Item selection component

```tsx
// features/cancel-return/components/return-item-selector.tsx
export function ReturnItemSelector({ items, selectedItems, onToggle, onQtyChange }) {
  return items.map((item) => (
    <ReturnItemRow
      key={item.id}
      item={item}
      selected={selectedItems.has(item.id)}
      onToggle={() => onToggle(item.id)}
      onQtyChange={(qty) => onQtyChange(item.id, qty)}
    />
  ));
}
```

## Evidence photo upload

```ts
import * as ImagePicker from 'expo-image-picker';

async function pickEvidencePhotos(): Promise<string[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    quality: 0.7,
    selectionLimit: 5,
  });

  if (!result.canceled) {
    return result.assets.map((a) => a.uri);
  }
  return [];
}
```

Upload photos to the media endpoint before submitting the return request:

```ts
// api.post sets Content-Type: application/json and JSON.stringifies the body, so it cannot
// send multipart/form-data. Use fetch directly for the upload.
async function uploadEvidencePhotos(uris: string[]): Promise<string[]> {
  return Promise.all(
    uris.map(async (uri) => {
      const formData = new FormData();
      formData.append('file', { uri, name: 'evidence.jpg', type: 'image/jpeg' } as unknown as Blob);
      const { apiBaseUrl, apiVersion, storeId } = getApiConfig();
      const res = await fetch(`${apiBaseUrl}/${apiVersion}/fo-mobile/stores/${storeId}/media/upload`, {
        method: 'POST',
        body: formData,
        // Do NOT set Content-Type — fetch sets multipart/form-data with boundary automatically
      });
      if (!res.ok) throw new Error('Upload failed');
      const json = await res.json();
      return json.url as string;
    }),
  );
}
```

## Mutation

```ts
export function useCreateReturnRequest(orderId: string) {
  const queryClient = useQueryClient();
  const api = useApiClient();

  return useMutation({
    mutationFn: async (data: ReturnRequestInput) => {
      // Upload evidence first if any
      const evidenceUrls = data.evidenceUris.length > 0
        ? await uploadEvidencePhotos(data.evidenceUris)
        : [];

      return api.post(`/return-requests`, {
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
```

## Partial returns

When the user selects only some items (or reduced quantities), the return request is a partial return. The NestJS service computes the refund amount based on the selected items' prices. The full order is NOT cancelled — only the selected items are returned.

## Error handling

| Error | Message |
| --- | --- |
| 422 — return window expired | "Thời gian yêu cầu hoàn trả đã hết hạn" |
| 422 — items already returned | "Sản phẩm này đã được yêu cầu hoàn trả" |
| 413 — photo too large | "Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn 10MB" |
| 500 / timeout | "Có lỗi xảy ra. Vui lòng thử lại." |
