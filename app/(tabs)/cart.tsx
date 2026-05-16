import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThreeStateCheckbox } from '@/components/ui/three-state-checkbox';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  useCart,
  useRemoveCartItem,
  useUpdateCartItem,
} from '@/features/cart/hooks/use-cart';
import { useCartSelection } from '@/features/cart/hooks/use-cart-selection';
import type { CartStorageItem } from '@/features/cart/types';
import { useCheckoutStore } from '@/features/checkout/store';
import { formatPrice } from '@/features/products/utils/format-price';

export default function CartScreen() {
  const scheme = useColorScheme() ?? 'light';
  const { data: items = [] } = useCart();
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();
  const selection = useCartSelection(items);
  const { setSelectedItemIds } = useCheckoutStore();

  const {
    selectedIds,
    selectedItems,
    selectionTotal,
    isAllSelected,
    isNoneSelected,
    isIndeterminate,
    toggleItem,
    toggleAll,
  } = selection;

  const currency = items[0]?.currency ?? 'VND';

  const handleProceed = () => {
    if (isNoneSelected) return;
    setSelectedItemIds([...selectedIds]);
    router.push('/checkout/shipping');
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Cart</ThemedText>
      </ThemedView>

      {items.length > 0 && (
        <SelectAllRow
          isAllSelected={isAllSelected}
          isIndeterminate={isIndeterminate}
          isNoneSelected={isNoneSelected}
          selectedCount={selectedItems.length}
          onToggle={toggleAll}
        />
      )}

      <FlatList
        data={items}
        keyExtractor={(item) => item.itemId}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <CartItemRow
            item={item}
            tint={Colors[scheme].tint}
            isSelected={selectedIds.has(item.itemId)}
            onToggle={toggleItem}
            onInc={() => update.mutate({ itemId: item.itemId, qty: item.qty + 1 })}
            onDec={() => update.mutate({ itemId: item.itemId, qty: item.qty - 1 })}
            onRemove={() => remove.mutate(item.itemId)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <ThemedText>Your cart is empty.</ThemedText>
          </View>
        }
      />

      {items.length > 0 && (
        <CartBottomBar
          isAllSelected={isAllSelected}
          isIndeterminate={isIndeterminate}
          isNoneSelected={isNoneSelected}
          selectionTotal={selectionTotal}
          selectedCount={selectedItems.length}
          currency={currency}
          tint={Colors[scheme].tint}
          onToggleAll={toggleAll}
          onProceed={handleProceed}
        />
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SelectAllRow({
  isAllSelected,
  isIndeterminate,
  isNoneSelected,
  selectedCount,
  onToggle,
}: {
  isAllSelected: boolean;
  isIndeterminate: boolean;
  isNoneSelected: boolean;
  selectedCount: number;
  onToggle: () => void;
}) {
  return (
    <ThemedView style={styles.selectAllRow}>
      <ThreeStateCheckbox
        state={isAllSelected ? 'checked' : isIndeterminate ? 'indeterminate' : 'unchecked'}
        onPress={onToggle}
        accessibilityLabel="Select all items"
      />
      <ThemedText style={styles.selectAllLabel}>
        {isAllSelected ? 'Deselect all' : 'Select all'}
      </ThemedText>
      {!isNoneSelected && (
        <ThemedText style={styles.selectedCount}>
          {selectedCount} selected
        </ThemedText>
      )}
    </ThemedView>
  );
}

function CartItemRow({
  item,
  tint,
  isSelected,
  onToggle,
  onInc,
  onDec,
  onRemove,
}: {
  item: CartStorageItem;
  tint: string;
  isSelected: boolean;
  onToggle: (id: string) => void;
  onInc: () => void;
  onDec: () => void;
  onRemove: () => void;
}) {
  return (
    <ThemedView style={[styles.row, !isSelected && styles.rowDeselected]}>
      <Pressable
        onPress={() => onToggle(item.itemId)}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isSelected }}
        style={styles.checkboxWrap}
      >
        <ThreeStateCheckbox
          state={isSelected ? 'checked' : 'unchecked'}
          onPress={() => onToggle(item.itemId)}
        />
      </Pressable>

      <View style={styles.thumbWrap}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]} />
        )}
      </View>

      <View style={styles.rowBody}>
        <ThemedText numberOfLines={2} style={styles.rowName}>
          {item.name}
        </ThemedText>
        <ThemedText style={styles.rowPrice}>
          {formatPrice(item.unitPrice * item.qty, item.currency)}
        </ThemedText>
        <View style={styles.qtyRow}>
          <Pressable onPress={onDec} hitSlop={8} style={styles.qtyBtn}>
            <IconSymbol name="minus" size={18} color={tint} />
          </Pressable>
          <ThemedText style={styles.qty}>{item.qty}</ThemedText>
          <Pressable onPress={onInc} hitSlop={8} style={styles.qtyBtn}>
            <IconSymbol name="plus" size={18} color={tint} />
          </Pressable>
          <Pressable onPress={onRemove} hitSlop={8} style={styles.removeBtn}>
            <IconSymbol name="trash" size={18} color={tint} />
          </Pressable>
        </View>
      </View>
    </ThemedView>
  );
}

function CartBottomBar({
  isAllSelected,
  isIndeterminate,
  isNoneSelected,
  selectionTotal,
  selectedCount,
  currency,
  tint,
  onToggleAll,
  onProceed,
}: {
  isAllSelected: boolean;
  isIndeterminate: boolean;
  isNoneSelected: boolean;
  selectionTotal: number;
  selectedCount: number;
  currency: string;
  tint: string;
  onToggleAll: () => void;
  onProceed: () => void;
}) {
  return (
    <ThemedView style={styles.footer}>
      <ThreeStateCheckbox
        state={isAllSelected ? 'checked' : isIndeterminate ? 'indeterminate' : 'unchecked'}
        onPress={onToggleAll}
        accessibilityLabel="Select all"
      />
      <ThemedText style={styles.footerAllLabel}>All</ThemedText>

      <View style={styles.footerRight}>
        <ThemedText style={styles.footerTotal}>
          {formatPrice(selectionTotal, currency)}
        </ThemedText>
        <Pressable
          style={[
            styles.cta,
            { backgroundColor: tint },
            isNoneSelected && styles.ctaDisabled,
          ]}
          onPress={onProceed}
          disabled={isNoneSelected}
          accessibilityRole="button"
          accessibilityState={{ disabled: isNoneSelected }}
        >
          <ThemedText style={styles.ctaText}>
            {isNoneSelected
              ? 'Select items'
              : `Checkout (${selectedCount})`}
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12 },

  // Select-all header row
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  selectAllLabel: { fontSize: 14, color: '#6B7280' },
  selectedCount: { marginLeft: 'auto', fontSize: 12, color: '#9CA3AF' },

  // Cart item list
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  empty: { padding: 48, alignItems: 'center' },

  // Cart item row
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10 },
  rowDeselected: { opacity: 0.45 },
  checkboxWrap: { padding: 4 },
  thumbWrap: { width: 72, height: 72, borderRadius: 8, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  thumbPlaceholder: { backgroundColor: '#E5E7EB' },
  rowBody: { flex: 1, gap: 4 },
  rowName: { fontSize: 14, fontWeight: '500' },
  rowPrice: { fontSize: 14, opacity: 0.85 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  qtyBtn: { padding: 4 },
  qty: { fontSize: 14, minWidth: 24, textAlign: 'center' },
  removeBtn: { marginLeft: 'auto', padding: 4 },

  // Bottom bar
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  footerAllLabel: { fontSize: 13, color: '#6B7280' },
  footerRight: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 12 },
  footerTotal: { fontSize: 15, fontWeight: '600' },
  cta: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8, alignItems: 'center' },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
