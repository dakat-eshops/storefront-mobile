import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ProductCard } from '@/features/products/components/product-card';
import { useProductList } from '@/features/products/hooks/use-products';
import type { ProductListItem } from '@/features/products/types';

export default function SearchScreen() {
  const scheme = useColorScheme() ?? 'light';
  const [q, setQ] = useState('');
  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage } =
    useProductList({ q: q || undefined });

  const items: ProductListItem[] = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ThemedView style={styles.header}>
        <TextInput
          style={[
            styles.input,
            {
              color: Colors[scheme].text,
              borderColor: Colors[scheme].icon,
              backgroundColor: Colors[scheme].background,
            },
          ]}
          placeholder="Search products…"
          placeholderTextColor={Colors[scheme].icon}
          value={q}
          onChangeText={setQ}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          style={[styles.scanBtn, { borderColor: Colors[scheme].icon }]}
          onPress={() => router.push('/scan')}
          accessibilityLabel="Scan barcode"
          accessibilityRole="button"
          hitSlop={8}
        >
          <Ionicons name="barcode-outline" size={24} color={Colors[scheme].text} />
        </Pressable>
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
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.empty}>
              <ThemedText>
                {q ? `No results for “${q}”` : 'Start typing to search.'}
              </ThemedText>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  scanBtn: {
    width: 44,
    height: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: 8, paddingBottom: 24 },
  empty: { padding: 48, alignItems: 'center' },
});
