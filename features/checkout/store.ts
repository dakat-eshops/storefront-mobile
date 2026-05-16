import { create } from 'zustand';

export type PaymentMethod = {
  key: string;
  name: string;
};

interface CheckoutState {
  selectedItemIds: string[];       // IDs of cart items the user selected to order
  shippingAddressId: string | null;
  paymentMethod: PaymentMethod | null;

  setSelectedItemIds: (ids: string[]) => void;
  setShippingAddressId: (id: string) => void;
  setPaymentMethod: (method: PaymentMethod) => void;

  // Call after order success AND when user abandons checkout mid-flow.
  reset: () => void;
}

export const useCheckoutStore = create<CheckoutState>((set) => ({
  selectedItemIds: [],
  shippingAddressId: null,
  paymentMethod: null,

  setSelectedItemIds: (ids) => set({ selectedItemIds: ids }),
  setShippingAddressId: (id) => set({ shippingAddressId: id }),
  setPaymentMethod: (method) => set({ paymentMethod: method }),

  // Zustand holds selectedItemIds in memory only (no persister) — selection is
  // intentionally ephemeral. An app-kill between Cart and Review asks the user
  // to re-select, which is acceptable (same as Shopee).
  reset: () =>
    set({ selectedItemIds: [], shippingAddressId: null, paymentMethod: null }),
}));
