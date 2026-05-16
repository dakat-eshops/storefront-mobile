# 01 · `useCartSelection` — Ephemeral Item Selection

Shopee-style selection on the cart screen. The user picks which items to buy before proceeding to checkout. Selection is ephemeral — it resets when the screen unmounts (same as Shopee).

## What the hook provides

```ts
// features/cart/hooks/use-cart-selection.ts
export type CartSelectionState = {
  selectedIds: Set<string>;
  toggleItem: (itemId: string) => void;
  toggleAll: () => void;
  selectAll: () => void;
  deselectAll: () => void;
  isAllSelected: boolean;
  isNoneSelected: boolean;
  isIndeterminate: boolean;         // some, but not all, items selected
  selectedItems: CartStorageItem[];
  selectedCount: number;            // sum of qty across selected items
  selectionTotal: number;           // unitPrice × qty for selected items
};

export function useCartSelection(items: CartStorageItem[]): CartSelectionState;
```

Default state: **all items pre-selected**. The most common case (buy everything) requires zero extra taps.

## Implementation

```ts
// features/cart/hooks/use-cart-selection.ts

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CartStorageItem } from '../types';

// Pure helper extracted outside the component to keep the useEffect body
// below RN/ESLint's cyclomatic complexity limit.
function syncSelectionWithCart(prev: Set<string>, allIds: string[]): Set<string> {
  const allIdSet = new Set(allIds);
  const next = new Set<string>();
  for (const id of prev) {
    if (allIdSet.has(id)) next.add(id);   // keep existing selections for items still in cart
  }
  for (const id of allIds) {
    if (!prev.has(id)) next.add(id);       // auto-select newly added items
  }
  // Return the same reference when nothing changed — avoids a re-render.
  if (next.size === prev.size && [...prev].every((id) => next.has(id))) return prev;
  return next;
}

export function useCartSelection(items: CartStorageItem[]): CartSelectionState {
  const allIds = useMemo(() => items.map((i) => i.itemId), [items]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(allIds));

  // Keep selection in sync when the cart changes while this hook is mounted:
  // • items removed from cart → pruned from selection
  // • items added to cart   → auto-selected
  // Functional updater reads the current state at fire time — no stale-closure risk.
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

  // Mobile CartStorageItem uses `qty`, not `quantity` (different from web FO).
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
    selectedIds, toggleItem, toggleAll, selectAll, deselectAll,
    isAllSelected, isNoneSelected, isIndeterminate,
    selectedItems, selectedCount, selectionTotal,
  };
}
```

> **`qty` not `quantity`**: Mobile `CartStorageItem.qty` is the field name. Web FO uses `quantity`. Keep them in sync if the shared type ever merges.

## Cart screen integration

Wire the hook into `app/(tabs)/cart.tsx`:

```tsx
// app/(tabs)/cart.tsx
import { useCartSelection } from '@/features/cart/hooks/use-cart-selection';
import { useCheckoutStore }  from '@/features/checkout/store';
import { router }            from 'expo-router';

export default function CartScreen() {
  const { data: items = [] } = useCart();
  const selection = useCartSelection(items);

  const { setSelectedItemIds } = useCheckoutStore();

  const handleProceed = () => {
    if (selection.isNoneSelected) return;
    // Hand selected IDs off to the checkout Zustand store before navigating.
    // See docs/cart/02-checkout-handoff.md for the full handoff pattern.
    setSelectedItemIds([...selection.selectedIds]);
    router.push('/checkout/shipping');
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
      {/* Select-all header */}
      <SelectAllRow selection={selection} items={items} />

      {/* Item list */}
      <FlatList
        data={items}
        keyExtractor={(i) => i.itemId}
        renderItem={({ item }) => (
          <CartItemRow
            item={item}
            isSelected={selection.selectedIds.has(item.itemId)}
            onToggle={selection.toggleItem}
            // ...qty/remove handlers
          />
        )}
      />

      {/* Sticky bottom bar */}
      <CartBottomBar selection={selection} onProceed={handleProceed} />
    </SafeAreaView>
  );
}
```

## Sub-components

Break into named components to stay within the linter's cyclomatic complexity limit.

### `SelectAllRow`

```tsx
function SelectAllRow({
  selection,
  items,
}: {
  selection: CartSelectionState;
  items: CartStorageItem[];
}) {
  return (
    <View style={styles.selectAllRow}>
      <ThreeStateCheckbox
        state={
          selection.isAllSelected
            ? 'checked'
            : selection.isIndeterminate
              ? 'indeterminate'
              : 'unchecked'
        }
        onPress={selection.toggleAll}
        accessibilityLabel="Select all items"
      />
      <ThemedText style={styles.selectAllLabel}>
        {selection.isAllSelected ? 'Deselect all' : 'Select all'}
      </ThemedText>
      {!selection.isNoneSelected && (
        <ThemedText style={styles.selectedCount}>
          {selection.selectedItems.length} selected
        </ThemedText>
      )}
    </View>
  );
}
```

### `CartItemRow` — checkbox + opacity

Unselected items render at reduced opacity to mirror the Shopee UX:

```tsx
function CartItemRow({
  item,
  isSelected,
  onToggle,
  // ... other props
}: { item: CartStorageItem; isSelected: boolean; onToggle: (id: string) => void; /* ... */ }) {
  return (
    <View style={[styles.row, !isSelected && styles.rowDeselected]}>
      <Pressable
        onPress={() => onToggle(item.itemId)}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isSelected }}
        style={styles.checkboxWrap}
      >
        <ThreeStateCheckbox state={isSelected ? 'checked' : 'unchecked'} onPress={() => onToggle(item.itemId)} />
      </Pressable>
      {/* image, name, price, qty stepper, remove */}
    </View>
  );
}

// In StyleSheet:
// rowDeselected: { opacity: 0.45 }
```

### `CartBottomBar`

```tsx
function CartBottomBar({
  selection,
  onProceed,
}: {
  selection: CartSelectionState;
  onProceed: () => void;
}) {
  const { selectionTotal, selectedItems, isNoneSelected, isAllSelected, isIndeterminate } = selection;
  const currency = selectedItems[0]?.currency ?? 'VND';

  return (
    <View style={styles.footer}>
      {/* Compact select-all on the left */}
      <ThreeStateCheckbox
        state={isAllSelected ? 'checked' : isIndeterminate ? 'indeterminate' : 'unchecked'}
        onPress={selection.toggleAll}
        accessibilityLabel="Select all"
      />
      <ThemedText style={styles.footerLabel}>All</ThemedText>

      {/* Running total + CTA on the right */}
      <View style={styles.footerRight}>
        <ThemedText style={styles.footerTotal}>
          {formatPrice(selectionTotal, currency)}
        </ThemedText>
        <Pressable
          style={[styles.cta, isNoneSelected && styles.ctaDisabled]}
          onPress={onProceed}
          disabled={isNoneSelected}
          accessibilityRole="button"
          accessibilityState={{ disabled: isNoneSelected }}
        >
          <ThemedText style={styles.ctaText}>
            {isNoneSelected
              ? 'Select items'
              : `Checkout (${selectedItems.length})`}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}
```

## `ThreeStateCheckbox` — indeterminate on RN

React Native has no native indeterminate checkbox. Render a custom icon instead:

```tsx
// components/ui/three-state-checkbox.tsx
import { Pressable, View } from 'react-native';
import { IconSymbol } from './icon-symbol';
import { Colors } from '@/constants/theme';

type CheckboxState = 'checked' | 'indeterminate' | 'unchecked';

export function ThreeStateCheckbox({
  state,
  onPress,
  accessibilityLabel,
}: {
  state: CheckboxState;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const isActive = state !== 'unchecked';
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: state === 'checked', mixed: state === 'indeterminate' }}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.box,
        isActive ? styles.boxActive : styles.boxInactive,
      ]}
    >
      {state === 'checked' && (
        <IconSymbol name="checkmark" size={12} color="#fff" />
      )}
      {state === 'indeterminate' && (
        <IconSymbol name="minus" size={12} color="#fff" />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 20, height: 20,
    borderRadius: 4, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  boxActive:   { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  boxInactive: { backgroundColor: 'transparent',     borderColor: '#D1D5DB' },
});
```

**Why not `expo-checkbox`?** Its `indeterminate` prop only works on iOS. The custom component above is cross-platform and adds zero extra packages.

## Rules

1. `useCartSelection` is pure `useState` — no MMKV, no Zustand, no network. It resets on screen unmount.
2. `selectedIds` is `Set<string>` of `itemId` values. Never store selection in the cart collection.
3. Use the functional `setSelectedIds((prev) => ...)` pattern for all updates — do not read `selectedIds` from the closure inside `useEffect`.
4. Min touch target: 44 × 44 pt for all checkboxes and buttons (`hitSlop={8}` on a 28 pt touch area covers this).
5. Disabled CTA when `isNoneSelected` — `disabled={true}` on `Pressable` + visual `opacity: 0.45`.
