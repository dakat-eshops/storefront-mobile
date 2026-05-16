import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CartStorageItem } from '../types';

// Pure helper — extracted outside the component to keep the useEffect body
// below ESLint's cyclomatic complexity limit and avoid stale-closure risk.
function syncSelectionWithCart(prev: Set<string>, allIds: string[]): Set<string> {
  const allIdSet = new Set(allIds);
  const next = new Set<string>();
  for (const id of prev) {
    if (allIdSet.has(id)) next.add(id); // keep existing selections for items still in cart
  }
  for (const id of allIds) {
    if (!prev.has(id)) next.add(id); // auto-select newly added items
  }
  // Return the same reference when nothing changed — avoids a re-render.
  if (next.size === prev.size && [...prev].every((id) => next.has(id))) return prev;
  return next;
}

export type CartSelectionState = {
  selectedIds: Set<string>;
  toggleItem: (itemId: string) => void;
  toggleAll: () => void;
  selectAll: () => void;
  deselectAll: () => void;
  isAllSelected: boolean;
  isNoneSelected: boolean;
  isIndeterminate: boolean;
  selectedItems: CartStorageItem[];
  selectedCount: number;   // sum of qty across selected items
  selectionTotal: number;  // unitPrice × qty for selected items
};

/**
 * Ephemeral Shopee-style item selection on the cart screen.
 *
 * Selection is pure useState — no MMKV, no Zustand, no network. It resets
 * when the screen unmounts (same as Shopee). Default: all items pre-selected.
 *
 * NOTE: Mobile CartStorageItem uses `qty` (not `quantity` like web FO).
 */
export function useCartSelection(items: CartStorageItem[]): CartSelectionState {
  const allIds = useMemo(() => items.map((i) => i.itemId), [items]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(allIds));

  // Keep selection in sync when cart changes while this hook is mounted.
  // Functional updater reads current state at fire time — no stale-closure risk.
  useEffect(() => {
    setSelectedIds((prev) => syncSelectionWithCart(prev, allIds));
  }, [allIds]);

  const toggleItem = useCallback((itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => setSelectedIds(new Set(allIds)), [allIds]);
  const deselectAll = useCallback(() => setSelectedIds(new Set()), []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.size === allIds.length ? new Set() : new Set(allIds),
    );
  }, [allIds]);

  const selectedItems = useMemo(
    () => items.filter((i) => selectedIds.has(i.itemId)),
    [items, selectedIds],
  );

  const selectedCount = useMemo(
    () => selectedItems.reduce((sum, i) => sum + i.qty, 0),
    [selectedItems],
  );

  const selectionTotal = useMemo(
    () => selectedItems.reduce((sum, i) => sum + i.unitPrice * i.qty, 0),
    [selectedItems],
  );

  const isAllSelected = selectedIds.size === allIds.length && allIds.length > 0;
  const isNoneSelected = selectedIds.size === 0;
  const isIndeterminate = !isAllSelected && !isNoneSelected;

  return {
    selectedIds,
    toggleItem,
    toggleAll,
    selectAll,
    deselectAll,
    isAllSelected,
    isNoneSelected,
    isIndeterminate,
    selectedItems,
    selectedCount,
    selectionTotal,
  };
}
