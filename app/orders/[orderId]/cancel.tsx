import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { CancelReasonSheet } from '@/features/cancel-return/components/cancel-reason-sheet';
import { useCancelOrder } from '@/features/cancel-return/hooks/use-cancel-order';
import { ApiError } from '@/libs/api-client';

export default function CancelScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [error, setError] = useState<string | null>(null);
  const cancelMutation = useCancelOrder(orderId ?? '');

  async function handleConfirm(reason: string, note?: string) {
    setError(null);
    try {
      await cancelMutation.mutateAsync({ reason, note });
      router.back();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setError('Đơn hàng đã được hủy trước đó');
        } else if (err.status === 422) {
          setError('Không thể hủy đơn hàng đang giao');
        } else {
          setError('Có lỗi xảy ra. Vui lòng thử lại.');
        }
      } else {
        setError('Có lỗi xảy ra. Vui lòng thử lại.');
      }
    }
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      {error && (
        <View style={styles.errorBox}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      )}
      {/* Sheet is always visible — this screen IS the cancel flow */}
      <CancelReasonSheet
        visible
        isLoading={cancelMutation.isPending}
        onConfirm={handleConfirm}
        onCancel={() => router.back()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  errorBox: {
    margin: 16,
    backgroundColor: '#fff0f0',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ffcccc',
  },
  errorText: { color: '#cc0000', fontSize: 14 },
});
