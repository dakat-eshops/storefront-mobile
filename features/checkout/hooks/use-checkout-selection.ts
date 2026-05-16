import { useMemo } from 'react';
import { useCart } from '@/features/cart/hooks/use-cart';
import type { CartStorageItem } from '@/features/cart/types';
import { useCheckoutStore } from '../store';

export type CheckoutSelectionResult = {
  selectedItems: CartStorageItem[];
  selectionTotal: number;
  selectionCurrency: string;
};

/**
 * Reads the selectedItemIds written by the cart screen into useCheckoutStore
 * and returns the subset of cart items that are going through this checkout.
 *
 * Falls back to the full cart when selectedItemIds is empty (guard: user
 * navigated directly to a checkout step without going through the cart screen,
 * or the store was cleared by an app restart).
 *
 * Use this hook in every checkout screen that shows a running total or item
 * list (shipping, payment, review).
 */
export function useCheckoutSelection(): CheckoutSelectionResult {
  const { selectedItemIds } = useCheckoutStore();
  const { data: allItems = [] } = useCart();

  const selectedItems = useMemo(() => {
    if (selectedItemIds.length === 0) return allItems; // fallback: full cart
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
