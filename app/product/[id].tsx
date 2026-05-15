import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAddToCart } from '@/features/cart/hooks/use-cart';
import { useProductDetail } from '@/features/products/hooks/use-products';
import { formatPrice } from '@/features/products/utils/format-price';

export default function ProductDetailScreen() {
  const scheme = useColorScheme() ?? 'light';
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError } = useProductDetail(id);
  const addToCart = useAddToCart();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.center}>
        <ThemedText>Product unavailable.</ThemedText>
      </View>
    );
  }

  const imageUrl =
    typeof data.defaultImage === 'string'
      ? data.defaultImage
      : data.defaultImage?.url ?? data.images?.[0]?.url ?? null;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <Stack.Screen options={{ title: data.name }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedView style={styles.imageWrap}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} contentFit="cover" />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]} />
          )}
        </ThemedView>
        <View style={styles.body}>
          <ThemedText type="title">{data.name}</ThemedText>
          <ThemedText style={styles.price}>
            {formatPrice(data.salePrice ?? data.basePrice, data.currency)}
          </ThemedText>
          {data.description ? (
            <ThemedText style={styles.description}>{data.description}</ThemedText>
          ) : null}
        </View>
      </ScrollView>
      <ThemedView style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          disabled={addToCart.isPending}
          onPress={() =>
            addToCart.mutate({
              itemId: data.id,
              productId: data.id,
              name: data.name,
              imageUrl: imageUrl ?? null,
              unitPrice: Number(data.salePrice ?? data.basePrice ?? 0),
              currency: data.currency ?? 'VND',
              qty: 1,
            })
          }
          style={[styles.cta, { backgroundColor: Colors[scheme].tint }]}
        >
          <ThemedText style={styles.ctaText}>
            {addToCart.isPending ? 'Adding…' : 'Add to cart'}
          </ThemedText>
        </Pressable>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: 32 },
  imageWrap: { aspectRatio: 1, width: '100%' },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { backgroundColor: '#E5E7EB' },
  body: { padding: 16, gap: 8 },
  price: { fontSize: 20, fontWeight: '600' },
  description: { marginTop: 12, opacity: 0.85, lineHeight: 20 },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  cta: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
