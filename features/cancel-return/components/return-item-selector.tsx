import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import type { OrderItem } from '@/features/orders/hooks/use-order-detail';

type Props = {
  items: OrderItem[];
  selectedItems: Map<string, number>;
  onToggle: (itemId: string) => void;
  onQtyChange: (itemId: string, qty: number) => void;
};

export function ReturnItemSelector({ items, selectedItems, onToggle, onQtyChange }: Props) {
  return (
    <View style={styles.container}>
      {items.map((item) => {
        const selected = selectedItems.has(item.id);
        const qty = selectedItems.get(item.id) ?? item.quantity;
        return (
          <ReturnItemRow
            key={item.id}
            item={item}
            selected={selected}
            qty={qty}
            onToggle={() => onToggle(item.id)}
            onQtyChange={(q) => onQtyChange(item.id, q)}
          />
        );
      })}
    </View>
  );
}

type RowProps = {
  item: OrderItem;
  selected: boolean;
  qty: number;
  onToggle: () => void;
  onQtyChange: (qty: number) => void;
};

function ReturnItemRow({ item, selected, qty, onToggle, onQtyChange }: RowProps) {
  return (
    <Pressable
      style={[styles.row, selected && styles.rowSelected]}
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
    >
      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
        {selected && <ThemedText style={styles.checkmark}>✓</ThemedText>}
      </View>
      <View style={styles.info}>
        <ThemedText style={styles.name} numberOfLines={2}>
          {item.itemName}
        </ThemedText>
        <ThemedText style={styles.price}>
          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.price)}
        </ThemedText>
      </View>
      {selected && item.quantity > 1 && (
        <View style={styles.qtyRow}>
          <Pressable
            style={styles.qtyBtn}
            onPress={() => onQtyChange(Math.max(1, qty - 1))}
            hitSlop={8}
          >
            <ThemedText style={styles.qtyBtnText}>−</ThemedText>
          </Pressable>
          <ThemedText style={styles.qtyValue}>{qty}</ThemedText>
          <Pressable
            style={styles.qtyBtn}
            onPress={() => onQtyChange(Math.min(item.quantity, qty + 1))}
            hitSlop={8}
          >
            <ThemedText style={styles.qtyBtnText}>+</ThemedText>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  rowSelected: {
    backgroundColor: '#f0f8ff',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  checkmark: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  info: { flex: 1 },
  name: { fontSize: 14, lineHeight: 20 },
  price: { fontSize: 13, opacity: 0.6, marginTop: 2 },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: { color: '#007AFF', fontSize: 16, lineHeight: 20 },
  qtyValue: { minWidth: 20, textAlign: 'center', fontSize: 14 },
});
