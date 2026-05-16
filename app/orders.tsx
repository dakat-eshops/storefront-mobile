import { useAuth } from '@clerk/clerk-expo';
import { Link } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useOrders } from '@/features/orders/hooks/use-orders';
import type { OrderListItem } from '@/features/orders/types';
import { formatPrice } from '@/features/products/utils/format-price';

export default function OrdersScreen() {
  const scheme = useColorScheme() ?? 'light';
  const { isSignedIn } = useAuth();
  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useOrders();

  if (!isSignedIn) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.center}>
          <ThemedText style={styles.signInPrompt}>
            Sign in to view your order history.
          </ThemedText>
          <Link href="/sign-in" asChild>
            <Pressable style={[styles.cta, { backgroundColor: Colors[scheme].tint }]}>
              <ThemedText style={styles.ctaText}>Sign in</ThemedText>
            </Pressable>
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  const items: OrderListItem[] = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">My Orders</ThemedText>
      </ThemedView>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <ThemedView style={styles.row}>
            <View style={styles.rowBody}>
              <ThemedText style={styles.orderNumber}>
                #{item.orderNumber ?? item.id.slice(0, 8)}
              </ThemedText>
              <ThemedText style={styles.status}>{item.status}</ThemedText>
            </View>
            <View>
              <ThemedText style={styles.total}>
                {formatPrice(item.total, item.currency)}
              </ThemedText>
              {item.placedAt ? (
                <ThemedText style={styles.placedAt}>
                  {new Date(item.placedAt).toLocaleDateString()}
                </ThemedText>
              ) : null}
            </View>
          </ThemedView>
        )}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator />
            </View>
          ) : (
            <View style={styles.empty}>
              <ThemedText>
                No orders yet. Place one and it will show up here.
              </ThemedText>
            </View>
          )
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderRadius: 10 },
  rowBody: { gap: 4 },
  orderNumber: { fontSize: 15, fontWeight: '500' },
  status: { fontSize: 13, opacity: 0.75 },
  total: { fontSize: 15, fontWeight: '600', textAlign: 'right' },
  placedAt: { fontSize: 12, opacity: 0.6, textAlign: 'right' },
  empty: { padding: 48, alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  signInPrompt: { fontSize: 16, textAlign: 'center' },
  cta: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 10 },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
