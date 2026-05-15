import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { ProductListItem } from '../types';
import { formatPrice } from '../utils/format-price';

type Props = { product: ProductListItem };

export function ProductCard({ product }: Props) {
  const imageUrl =
    typeof product.defaultImage === 'string'
      ? product.defaultImage
      : product.defaultImage?.url ?? null;

  return (
    <Link href={`/product/${product.slug ?? product.id}`} asChild>
      <Pressable style={styles.card}>
        <ThemedView style={styles.imageWrapper}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.image}
              contentFit="cover"
              transition={150}
            />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]} />
          )}
        </ThemedView>
        <ThemedText style={styles.name} numberOfLines={2}>
          {product.name}
        </ThemedText>
        <ThemedText style={styles.price}>
          {formatPrice(product.salePrice ?? product.basePrice, product.currency)}
        </ThemedText>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, padding: 8 },
  imageWrapper: {
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { backgroundColor: '#E5E7EB' },
  name: { fontSize: 14, fontWeight: '500' },
  price: { fontSize: 14, marginTop: 4, opacity: 0.85 },
});
