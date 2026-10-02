import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { OrderQrCode } from '@/features/orders/components/OrderQrCode';
import { formatPrice } from '@/features/products/utils/format-price';
import { useOrderDetail } from '@/features/orders/hooks/use-order-detail';
import type { OrderStatus, OrderDetail } from '@/features/orders/hooks/use-order-detail';
import { CancelReasonSheet } from '@/features/cancel-return/components/cancel-reason-sheet';
import { useCancelOrder } from '@/features/cancel-return/hooks/use-cancel-order';
import { ApiError } from '@/libs/api-client';

function statusLabel(status: OrderStatus): string {
  switch (status) {
    case 'pending': return 'Chờ xác nhận';
    case 'confirmed': return 'Đã xác nhận';
    case 'processing': return 'Đang xử lý';
    case 'shipped': return 'Đang giao hàng';
    case 'delivered': return 'Đã giao hàng';
    case 'cancelled': return 'Đã hủy';
    case 'return_requested': return 'Đang yêu cầu hoàn trả';
    case 'returned': return 'Đã hoàn trả';
    default: return status;
  }
}

function cancelRequestLabel(status: string): string {
  switch (status) {
    case 'pending_review': return 'Chờ xét hủy';
    case 'approved': return 'Yêu cầu hủy được duyệt';
    case 'rejected': return 'Yêu cầu hủy bị từ chối';
    default: return status;
  }
}

function returnRequestLabel(status: string): string {
  switch (status) {
    case 'pending_review': return 'Chờ xét hoàn trả';
    case 'approved': return 'Yêu cầu hoàn trả được duyệt';
    case 'items_received': return 'Đã nhận hàng hoàn trả';
    case 'inspected': return 'Đã kiểm tra hàng';
    case 'refund_issued': return 'Đã hoàn tiền';
    case 'rejected': return 'Yêu cầu hoàn trả bị từ chối';
    default: return status;
  }
}

function OrderSummary({ order }: { order: OrderDetail }) {
  return (
    <View style={styles.card}>
      <ThemedText type="defaultSemiBold" style={styles.cardTitle}>Chi tiết đơn hàng</ThemedText>
      {order.orderItems.map((item) => (
        <View key={item.id} style={styles.lineItem}>
          <View style={styles.lineItemLeft}>
            <ThemedText style={styles.itemName} numberOfLines={2}>{item.itemName}</ThemedText>
            <ThemedText style={styles.itemQty}>x{item.quantity}</ThemedText>
          </View>
          <ThemedText style={styles.itemPrice}>{formatPrice(item.price * item.quantity, order.currency)}</ThemedText>
        </View>
      ))}
      <View style={styles.divider} />
      <View style={styles.summaryRow}>
        <ThemedText style={styles.summaryLabel}>Tạm tính</ThemedText>
        <ThemedText>{formatPrice(order.subtotal, order.currency)}</ThemedText>
      </View>
      <View style={styles.summaryRow}>
        <ThemedText style={styles.summaryLabel}>Phí giao hàng</ThemedText>
        <ThemedText>{formatPrice(order.shippingFee, order.currency)}</ThemedText>
      </View>
      {order.discountAmount > 0 && (
        <View style={styles.summaryRow}>
          <ThemedText style={styles.summaryLabel}>Giảm giá</ThemedText>
          <ThemedText style={styles.discount}>−{formatPrice(order.discountAmount, order.currency)}</ThemedText>
        </View>
      )}
      {(order.loyaltyPointsUsed ?? 0) > 0 && (
        <View style={styles.summaryRow}>
          <ThemedText style={styles.summaryLabel}>Điểm tích lũy dùng</ThemedText>
          <ThemedText style={styles.discount}>−{order.loyaltyPointsUsed} điểm</ThemedText>
        </View>
      )}
      <View style={[styles.summaryRow, styles.totalRow]}>
        <ThemedText type="defaultSemiBold">Tổng cộng</ThemedText>
        <ThemedText type="defaultSemiBold">{formatPrice(order.totalAmount, order.currency)}</ThemedText>
      </View>
      {(order.loyaltyPointsEarned ?? 0) > 0 && (
        <View style={styles.summaryRow}>
          <ThemedText style={styles.summaryLabel}>Điểm tích lũy nhận được</ThemedText>
          <ThemedText style={styles.loyaltyEarned}>+{order.loyaltyPointsEarned} điểm</ThemedText>
        </View>
      )}
      {(order.loyaltyPointsRestored ?? 0) > 0 && (
        <View style={styles.summaryRow}>
          <ThemedText style={styles.summaryLabel}>Điểm tích lũy hoàn trả</ThemedText>
          <ThemedText style={styles.loyaltyEarned}>+{order.loyaltyPointsRestored} điểm</ThemedText>
        </View>
      )}
    </View>
  );
}

function RequestStatusSection({ order }: { order: OrderDetail }) {
  if (!order.cancelRequest && !order.returnRequest) return null;
  return (
    <View style={styles.card}>
      <ThemedText type="defaultSemiBold" style={styles.cardTitle}>Trạng thái yêu cầu</ThemedText>
      {order.cancelRequest && (
        <View style={styles.requestRow}>
          <ThemedText style={styles.requestType}>Hủy đơn:</ThemedText>
          <ThemedText style={styles.requestStatus}>
            {cancelRequestLabel(order.cancelRequest.status)}
          </ThemedText>
        </View>
      )}
      {order.cancelRequest?.note && (
        <ThemedText style={styles.requestNote}>{order.cancelRequest.note}</ThemedText>
      )}
      {order.returnRequest && (
        <View style={styles.requestRow}>
          <ThemedText style={styles.requestType}>Hoàn trả:</ThemedText>
          <ThemedText style={styles.requestStatus}>
            {returnRequestLabel(order.returnRequest.status)}
          </ThemedText>
        </View>
      )}
      {order.returnRequest?.refundAmount != null && (
        <ThemedText style={styles.refundAmount}>
          Hoàn tiền: {formatPrice(order.returnRequest.refundAmount, order.currency)}
        </ThemedText>
      )}
      {(order.returnRequest?.loyaltyPointsRestored ?? 0) > 0 && (
        <ThemedText style={styles.loyaltyEarned}>
          +{order.returnRequest?.loyaltyPointsRestored} điểm hoàn trả
        </ThemedText>
      )}
    </View>
  );
}

export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { data: order, isLoading, isError, refetch } = useOrderDetail(orderId);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelSheetVisible, setCancelSheetVisible] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const cancelMutation = useCancelOrder(orderId ?? '');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  async function handleCancelConfirm(reason: string, note?: string) {
    setCancelError(null);
    try {
      await cancelMutation.mutateAsync({ reason, note });
      setCancelSheetVisible(false);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setCancelError('Đơn hàng đã được hủy trước đó');
        } else if (err.status === 422) {
          setCancelError('Không thể hủy đơn hàng đang giao');
        } else {
          setCancelError('Có lỗi xảy ra. Vui lòng thử lại.');
        }
      } else {
        setCancelError('Có lỗi xảy ra. Vui lòng thử lại.');
      }
    }
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (isError || !order) {
    return (
      <View style={styles.center}>
        <ThemedText>Không thể tải đơn hàng.</ThemedText>
      </View>
    );
  }

  const canCancel = order.status === 'pending' || order.status === 'confirmed';
  const canReturn = order.status === 'delivered';

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <Stack.Screen options={{ title: `Đơn ${order.orderNo}` }} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Status */}
        <View style={styles.statusSection}>
          <ThemedText type="title" style={styles.orderNo}>{order.orderNo}</ThemedText>
          <View style={styles.statusBadge}>
            <ThemedText style={styles.statusText}>{statusLabel(order.status)}</ThemedText>
          </View>
        </View>

        {/* QR Code */}
        <View
          style={styles.qrSection}
          accessible
          accessibilityLabel={`Mã QR đơn hàng ${order.orderNo}. Cho nhân viên quét.`}
        >
          <ThemedText style={styles.sectionTitle}>Cho nhân viên quét</ThemedText>
          <OrderQrCode storeId={order.storeId} orderId={order.id} orderNumber={order.orderNo} />
        </View>

        {/* Request status (cancel/return) */}
        <RequestStatusSection order={order} />

        {/* Order summary */}
        <OrderSummary order={order} />

        {/* Error message */}
        {cancelError && (
          <View style={styles.errorBox}>
            <ThemedText style={styles.errorText}>{cancelError}</ThemedText>
          </View>
        )}

        {/* Action buttons */}
        {canCancel && !order.cancelRequest && (
          <Pressable
            style={styles.cancelBtn}
            onPress={() => { setCancelError(null); setCancelSheetVisible(true); }}
          >
            <ThemedText style={styles.cancelBtnText}>Hủy đơn hàng</ThemedText>
          </Pressable>
        )}
        {canReturn && !order.returnRequest && (
          <Pressable
            style={styles.returnBtn}
            onPress={() => router.push(`/orders/${orderId}/return`)}
          >
            <ThemedText style={styles.returnBtnText}>Yêu cầu hoàn trả</ThemedText>
          </Pressable>
        )}
      </ScrollView>

      <CancelReasonSheet
        visible={cancelSheetVisible}
        isLoading={cancelMutation.isPending}
        onConfirm={handleCancelConfirm}
        onCancel={() => { setCancelSheetVisible(false); setCancelError(null); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, gap: 16, paddingBottom: 48 },
  statusSection: { gap: 8 },
  orderNo: { fontSize: 22, lineHeight: 28 },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e8f4f8',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: { fontSize: 13, color: '#0077aa', fontWeight: '600' },
  qrSection: { alignItems: 'center', gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '600', opacity: 0.7 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: { fontSize: 15, marginBottom: 4 },
  lineItem: { flexDirection: 'row', gap: 8 },
  lineItemLeft: { flex: 1, gap: 2 },
  itemName: { fontSize: 14 },
  itemQty: { fontSize: 13, opacity: 0.5 },
  itemPrice: { fontSize: 14, fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#e5e5e5', marginVertical: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { opacity: 0.6 },
  discount: { color: '#34C759' },
  loyaltyEarned: { color: '#34C759', fontWeight: '600' },
  totalRow: { marginTop: 4 },
  requestRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  requestType: { opacity: 0.6, fontSize: 14 },
  requestStatus: { fontWeight: '600', fontSize: 14 },
  requestNote: { fontSize: 13, opacity: 0.6, fontStyle: 'italic' },
  refundAmount: { fontSize: 14, color: '#007AFF', fontWeight: '600' },
  errorBox: {
    backgroundColor: '#fff0f0',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ffcccc',
  },
  errorText: { color: '#cc0000', fontSize: 14 },
  cancelBtn: {
    borderWidth: 1.5,
    borderColor: '#FF3B30',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: { color: '#FF3B30', fontWeight: '600', fontSize: 15 },
  returnBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  returnBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
