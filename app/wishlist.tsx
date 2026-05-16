import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  useRemoveFromWishlist,
  useWishlist,
} from '@/features/wishlist/hooks/use-wishlist';
import { formatPrice } from '@/features/products/utils/format-price';

export default function WishlistScreen() {
  const scheme = useColorScheme() ?? 'light';
  const { data: items = [] } = useWishlist();
  const remove = useRemoveFromWishlist();

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Wishlist</ThemedText>
      </ThemedView>
      <FlatList
        data={items}
        keyExtractor={(item) => item.productId}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Link href={`/product/${item.slug ?? item.productId}`} asChild>
            <Pressable style={styles.row}>
              <View style={styles.thumbWrap}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.thumb} contentFit="cover" />
                ) : (
                  <View style={[styles.thumb, styles.placeholder]} />
                )}
              </View>
              <View style={styles.body}>
                <ThemedText numberOfLines={2} style={styles.name}>
                  {item.name}
                </ThemedText>
                <ThemedText style={styles.price}>
                  {formatPrice(item.unitPrice, item.currency)}
                </ThemedText>
              </View>
              <Pressable
                onPress={() => remove.mutate(item.productId)}
                hitSlop={12}
                style={styles.removeBtn}
              >
                <IconSymbol name="trash" size={20} color={Colors[scheme].tint} />
              </Pressable>
            </Pressable>
          </Link>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <ThemedText>Your wishlist is empty.</ThemedText>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  row: { flexDirection: 'row', gap: 12, padding: 12, alignItems: 'center' },
  thumbWrap: { width: 64, height: 64, borderRadius: 8, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  placeholder: { backgroundColor: '#E5E7EB' },
  body: { flex: 1, gap: 4 },
  name: { fontSize: 14, fontWeight: '500' },
  price: { fontSize: 14, opacity: 0.85 },
  removeBtn: { padding: 4 },
  empty: { padding: 48, alignItems: 'center' },
});
