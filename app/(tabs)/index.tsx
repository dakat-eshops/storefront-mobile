import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ProductCard } from '@/features/products/components/product-card';
import { useProductList } from '@/features/products/hooks/use-products';
import type { ProductListItem } from '@/features/products/types';

export default function HomeScreen() {
  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage, refetch, isRefetching } =
    useProductList({ isFeatured: true });

  const items: ProductListItem[] = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">KhanhStore</ThemedText>
        <ThemedText style={styles.subtitle}>Featured</ThemedText>
      </ThemedView>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <ProductCard product={item} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.empty}>
              <ThemedText>No products yet.</ThemedText>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  subtitle: { opacity: 0.7, marginTop: 4 },
  list: { paddingHorizontal: 8, paddingBottom: 24 },
  empty: { padding: 48, alignItems: 'center' },
});
