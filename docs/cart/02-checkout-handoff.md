# 02 · Cross-Step Checkout Handoff

How the cart-page item selection survives navigation across the checkout screens (Cart → Shipping → Payment → Review).

## The problem

React state does not survive `router.push`. When the user taps "Checkout" on the cart screen and navigates to `/checkout/shipping`, the `useCartSelection` hook unmounts and its `selectedIds` set is gone. The shipping, payment, and review screens need to know which items were selected.

**Web FO solved this with `sessionStorage`** (`checkout-selection.ts` — writes on proceed, reads on each subsequent step, clears after order success). `sessionStorage` does not exist in React Native.

## The mobile solution — extend `useCheckoutStore`

The checkout flow already uses a Zustand store (`features/checkout/store.ts`, documented in `docs/checkout/01-flow.md`). Extend it with `selectedItemIds`:

```ts
// features/checkout/store.ts
import { create } from 'zustand';
import type { PaymentMethod } from '@/features/payments/types';

interface CheckoutState {
  selectedItemIds: string[];          // ← new: IDs of items to order
  shippingAddressId: string | null;
  paymentMethod: PaymentMethod | null;

  setSelectedItemIds: (ids: string[]) => void;   // ← new
  setShippingAddressId: (id: string) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  reset: () => void;
}

export const useCheckoutStore = create<CheckoutState>((set) => ({
  selectedItemIds: [],
  shippingAddressId: null,
  paymentMethod: null,

  setSelectedItemIds: (ids) => set({ selectedItemIds: ids }),
  setShippingAddressId: (id) => set({ shippingAddressId: id }),
  setPaymentMethod: (method) => set({ paymentMethod: method }),

  // Call after order success AND when user abandons checkout mid-flow.
  reset: () => set({ selectedItemIds: [], shippingAddressId: null, paymentMethod: null }),
}));
```

> Zustand holds `selectedItemIds` in memory only (no persister). This is correct — selection is intentionally ephemeral, same as Shopee. An app-kill between Cart and Review asks the user to re-select, which is acceptable.

## Lifecycle

```text
Cart screen
  useCartSelection(items)  →  Set<string>
  user taps "Checkout"
    └── setSelectedItemIds([...selectedIds])   ← write to store
        router.push('/checkout/shipping')

/checkout/shipping
  (reads shippingAddress — doesn't need selectedItemIds yet)

/checkout/payment
  (reads shippingAddressId — doesn't need selectedItemIds yet)

/checkout/review
  const { selectedItemIds } = useCheckoutStore()
  const { data: allItems = [] } = useCart()
  const selectedItems = allItems.filter(i => selectedItemIds.includes(i.itemId))
  → renders order summary for selected items only
  → posts { cartItems: selectedItems, ... } to /checkout/payment-intent

order success
  └── removeOrderedItems(selectedItems)
      useCheckoutStore.getState().reset()
      router.replace(`/orders/${orderId}`)
```

## Guard: re-select if store is empty on navigate-back

If the user force-quits and restarts mid-checkout, `selectedItemIds` will be empty (Zustand memory is cleared). Add a guard on the review screen:

```ts
// app/checkout/review.tsx
const { selectedItemIds, reset } = useCheckoutStore();
const { data: allItems = [] } = useCart();

useEffect(() => {
  if (selectedItemIds.length === 0 && allItems.length > 0) {
    // Store was cleared (app restart / memory pressure). Send user back to cart to re-select.
    reset();
    router.replace('/(tabs)/cart');
  }
}, [selectedItemIds, allItems]);
```

## Review screen — scoping items and totals

```ts
// features/checkout/hooks/use-checkout-selection.ts

import { useCheckoutStore } from '../store';
import { useCart }          from '@/features/cart/hooks/use-cart';
import { useMemo }          from 'react';
import type { CartStorageItem } from '@/features/cart/types';

export function useCheckoutSelection(): {
  selectedItems: CartStorageItem[];
  selectionTotal: number;
  selectionCurrency: string;
} {
  const { selectedItemIds } = useCheckoutStore();
  const { data: allItems = [] } = useCart();

  const selectedItems = useMemo(() => {
    if (selectedItemIds.length === 0) return allItems;   // fallback: full cart
    const idSet = new Set(selectedItemIds);
    return allItems.filter((i) => idSet.has(i.itemId));
  }, [allItems, selectedItemIds]);

  const selectionTotal = useMemo(
    () => selectedItems.reduce((sum, i) => sum + i.unitPrice * i.qty, 0),
    [selectedItems],
  );

  return {
    selectedItems,
    selectionTotal,
    selectionCurrency: selectedItems[0]?.currency ?? 'VND',
  };
}
```

Use this hook in the shipping, payment, and review screens wherever a running total or item list is shown:

```ts
// app/checkout/review.tsx
const { selectedItems, selectionTotal, selectionCurrency } = useCheckoutSelection();
```

## Place-order payload — only selected items

```ts
// features/checkout/hooks/use-place-order.ts
export function usePlaceOrder() {
  const { shippingAddressId, paymentMethod, reset } = useCheckoutStore();
  const { selectedItems } = useCheckoutSelection();
  const remove = useRemoveCartItem();
  const api = useApiClient();

  return useMutation({
    retry: 0,   // NEVER retry payment mutations — double-submit risk
    mutationFn: () =>
      api.post<PlaceOrderResult>('/checkout/payment-intent', {
        cartItems: selectedItems,             // ← only selected items
        shippingAddressId,
        paymentMethod: paymentMethod?.key,
      }),

    onSuccess: async (result) => {
      // 1. Remove only the ordered items — the rest of the cart stays intact.
      for (const item of selectedItems) {
        try {
          await remove.mutateAsync(item.itemId);
        } catch {
          // concurrent removal from another device / screen — safe to ignore
        }
      }
      // 2. Clear checkout state.
      reset();
      // 3. Navigate to order confirmation.
      router.replace(`/orders/${result.orderId}`);
    },

    onError: () => {
      // Do NOT reset checkout state on error — user may want to retry.
    },
  });
}
```

> **`removeAll` is wrong here.** Removing all cart items when only 3 out of 100 were ordered would silently destroy the other 97. Always remove per `selectedItems`.

## Abandonment cleanup

Call `reset()` when the user navigates away without completing checkout:

```ts
// app/checkout/_layout.tsx  (or in each checkout screen's useEffect)
useFocusEffect(
  useCallback(() => {
    return () => {
      // If we're leaving checkout without a completed order, reset the store.
      // The `router.replace('/orders/:id')` on success runs before unmount,
      // so by this point we know the user abandoned.
      // Check orderId to avoid clearing on success navigation.
      if (!completedOrderId) {
        useCheckoutStore.getState().reset();
      }
    };
  }, [completedOrderId]),
);
```

## Why not use navigation params?

| Option | Why rejected |
| --- | --- |
| `router.push('/checkout/shipping?ids=a,b,c,..z')` | URL length limits (~2K chars) break with large carts; IDs are UUIDs (36 chars each) |
| `router.push` with typed params (Expo Router) | Params are serialised to strings; arrays require encoding/decoding; still hits URL length |
| MMKV key (mirrors web `sessionStorage`) | Works, but Zustand is already the cross-screen state mechanism for checkout — introducing a second mechanism for one field adds fragmentation |
| React context mounted above the tab navigator | Context survives navigation within the stack, but **not** an app restart or memory-pressure eviction — same limitation as Zustand without a persister, but less ergonomic |

Zustand is the right choice because:

1. Already used for `shippingAddressId` + `paymentMethod` in the same flow.
2. `reset()` clears everything in one call — no stale MMKV keys to hunt down.
3. Consistent: every checkout screen reads from `useCheckoutStore`, not a mixture of Zustand + MMKV.

## Summary — differences from web FO

| Concern | Web FO | Mobile |
| --- | --- | --- |
| Cross-step handoff mechanism | `sessionStorage` (`checkout-selection.ts`) | Zustand `useCheckoutStore.selectedItemIds` |
| Write | `saveCheckoutSelection([...ids])` | `setSelectedItemIds([...ids])` |
| Read | `readCheckoutSelection()` | `useCheckoutStore().selectedItemIds` |
| Clear after order success | `clearCheckoutSelection()` | `useCheckoutStore().reset()` |
| Fallback (navigate direct to step N) | Fall back to full `cart.items` | Fall back to full `cart.items` (same logic) |
| App-kill between steps | Selection gone, but web refresh behaves the same | Selection gone → guard redirects to cart |
