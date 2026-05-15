import { Image } from 'expo-image';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  useCart,
  useRemoveCartItem,
  useUpdateCartItem,
} from '@/features/cart/hooks/use-cart';
import type { CartStorageItem } from '@/features/cart/types';
import { formatPrice } from '@/features/products/utils/format-price';

export default function CartScreen() {
  const scheme = useColorScheme() ?? 'light';
  const { data: items = [] } = useCart();
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();

  const total = items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
  const currency = items[0]?.currency ?? 'VND';

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Cart</ThemedText>
      </ThemedView>
      <FlatList
        data={items}
        keyExtractor={(item) => item.itemId}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <CartRow
            item={item}
            tint={Colors[scheme].tint}
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
        <ThemedView style={styles.footer}>
          <View style={styles.totalRow}>
            <ThemedText style={styles.totalLabel}>Total</ThemedText>
            <ThemedText style={styles.totalValue}>
              {formatPrice(total, currency)}
            </ThemedText>
          </View>
          <Pressable style={[styles.cta, { backgroundColor: Colors[scheme].tint }]}>
            <ThemedText style={styles.ctaText}>Checkout</ThemedText>
          </Pressable>
        </ThemedView>
      )}
    </SafeAreaView>
  );
}

function CartRow({
  item,
  tint,
  onInc,
  onDec,
  onRemove,
}: {
  item: CartStorageItem;
  tint: string;
  onInc: () => void;
  onDec: () => void;
  onRemove: () => void;
}) {
  return (
    <ThemedView style={styles.row}>
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

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  empty: { padding: 48, alignItems: 'center' },
  row: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 10 },
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
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 16 },
  totalValue: { fontSize: 18, fontWeight: '600' },
  cta: { paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
