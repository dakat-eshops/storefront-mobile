import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRemoveCartItem } from '@/features/cart/hooks/use-cart';
import { useApiClient } from '@/libs/api-client';
import { useCheckoutStore } from '../store';
import { useCheckoutSelection } from './use-checkout-selection';

type PlaceOrderResult = { orderId: string };

/**
 * Place-order mutation.
 *
 * Sends only the selected cart items to /checkout/payment-intent. On success:
 * 1. Removes ordered items one-by-one (NOT removeAll — the rest of the cart stays).
 * 2. Resets the checkout Zustand store.
 * 3. Navigates to the order confirmation screen.
 *
 * retry: 0 — NEVER retry payment mutations (double-submit risk).
 * onError: does NOT reset checkout state — user may want to retry.
 */
export function usePlaceOrder() {
  const { shippingAddressId, paymentMethod, reset } = useCheckoutStore();
  const { selectedItems } = useCheckoutSelection();
  const remove = useRemoveCartItem();
  const api = useApiClient();

  return useMutation<PlaceOrderResult>({
    retry: 0,
    mutationFn: () =>
      api.post<PlaceOrderResult>('/checkout/payment-intent', {
        cartItems: selectedItems,
        shippingAddressId,
        paymentMethod: paymentMethod?.key,
      }),

    onSuccess: async (result) => {
      // Remove only the ordered items — the rest of the cart stays intact.
      for (const item of selectedItems) {
        try {
          await remove.mutateAsync(item.itemId);
        } catch {
          // concurrent removal from another device — safe to ignore
        }
      }
      reset();
      router.replace(`/orders/${result.orderId}`);
    },
  });
}
