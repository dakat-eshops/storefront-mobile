import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ReturnItemSelector } from '@/features/cancel-return/components/return-item-selector';
import { useCreateReturnRequest } from '@/features/cancel-return/hooks/use-create-return-request';
import type { ReturnItemInput } from '@/features/cancel-return/hooks/use-create-return-request';
import { useOrderDetail } from '@/features/orders/hooks/use-order-detail';
import { ApiError } from '@/libs/api-client';

const RETURN_REASONS = [
  { key: 'damaged', label: 'Hàng bị hỏng / lỗi' },
  { key: 'wrong_item', label: 'Hàng không đúng sản phẩm đã đặt' },
  { key: 'quality_issue', label: 'Chất lượng không như mô tả' },
  { key: 'changed_mind', label: 'Tôi đổi ý' },
  { key: 'other', label: 'Lý do khác' },
] as const;

const TOTAL_STEPS = 4;

type Step = 1 | 2 | 3 | 4;

export default function ReturnScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { data: order, isLoading } = useOrderDetail(orderId);
  const mutation = useCreateReturnRequest(orderId ?? '');

  const [step, setStep] = useState<Step>(1);
  const [selectedItems, setSelectedItems] = useState<Map<string, number>>(new Map());
  const [reason, setReason] = useState<string>('');
  const [note, setNote] = useState('');
  const [evidenceUris, setEvidenceUris] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function toggleItem(itemId: string) {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        const item = order?.orderItems.find((i) => i.id === itemId);
        next.set(itemId, item?.quantity ?? 1);
      }
      return next;
    });
  }

  function setItemQty(itemId: string, qty: number) {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      next.set(itemId, qty);
      return next;
    });
  }

  async function pickPhotos() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
      selectionLimit: 5,
    });
    if (!result.canceled) {
      const newUris = result.assets.map((a) => a.uri);
      setEvidenceUris((prev) => [...prev, ...newUris].slice(0, 5));
    }
  }

  function removePhoto(uri: string) {
    setEvidenceUris((prev) => prev.filter((u) => u !== uri));
  }

  async function handleSubmit() {
    setSubmitError(null);
    const items: ReturnItemInput[] = Array.from(selectedItems.entries()).map(([orderItemId, quantity]) => ({
      orderItemId,
      quantity,
    }));
    try {
      await mutation.mutateAsync({ selectedItems: items, reason, note: note.trim() || undefined, evidenceUris });
      router.back();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) {
          setSubmitError('Thời gian yêu cầu hoàn trả đã hết hạn hoặc sản phẩm này đã được yêu cầu hoàn trả.');
        } else if (err.status === 413) {
          setSubmitError('Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn 10MB.');
        } else {
          setSubmitError('Có lỗi xảy ra. Vui lòng thử lại.');
        }
      } else {
        setSubmitError('Có lỗi xảy ra. Vui lòng thử lại.');
      }
    }
  }

  function next() { setStep((s) => Math.min(s + 1, TOTAL_STEPS) as Step); }
  function back() {
    if (step === 1) { router.back(); return; }
    setStep((s) => Math.max(s - 1, 1) as Step);
  }

  if (isLoading || !order) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const stepTitles: Record<Step, string> = {
    1: 'Chọn sản phẩm hoàn trả',
    2: 'Lý do hoàn trả',
    3: 'Ảnh minh chứng',
    4: 'Xác nhận yêu cầu',
  };

  const canProceedStep1 = selectedItems.size > 0;
  const canProceedStep2 = reason !== '';

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <Stack.Screen options={{ title: stepTitles[step] }} />

      {/* Progress bar */}
      <View style={styles.progressBar}>
        {[1, 2, 3, 4].map((s) => (
          <View key={s} style={[styles.progressDot, s <= step && styles.progressDotActive]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Step 1: Item selection */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <ThemedText style={styles.stepHint}>Chọn sản phẩm bạn muốn hoàn trả:</ThemedText>
            <ReturnItemSelector
              items={order.orderItems}
              selectedItems={selectedItems}
              onToggle={toggleItem}
              onQtyChange={setItemQty}
            />
          </View>
        )}

        {/* Step 2: Reason */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <ThemedText style={styles.stepHint}>Vì sao bạn muốn hoàn trả?</ThemedText>
            {RETURN_REASONS.map((r) => (
              <Pressable
                key={r.key}
                style={[styles.reasonRow, reason === r.label && styles.reasonRowSelected]}
                onPress={() => setReason(r.label)}
              >
                <View style={[styles.radio, reason === r.label && styles.radioSelected]} />
                <ThemedText style={styles.reasonLabel}>{r.label}</ThemedText>
              </Pressable>
            ))}
            <TextInput
              style={styles.noteInput}
              placeholder="Ghi chú thêm (không bắt buộc)..."
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={300}
            />
          </View>
        )}

        {/* Step 3: Photos */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <ThemedText style={styles.stepHint}>
              Thêm ảnh minh chứng (tối đa 5 ảnh, không bắt buộc):
            </ThemedText>
            <View style={styles.photoGrid}>
              {evidenceUris.map((uri) => (
                <View key={uri} style={styles.photoThumb}>
                  <Image source={{ uri }} style={styles.thumbImg} />
                  <Pressable style={styles.removePhoto} onPress={() => removePhoto(uri)} hitSlop={8}>
                    <Text style={styles.removePhotoText}>✕</Text>
                  </Pressable>
                </View>
              ))}
              {evidenceUris.length < 5 && (
                <Pressable style={styles.addPhotoBtn} onPress={pickPhotos}>
                  <Text style={styles.addPhotoPlus}>+</Text>
                  <ThemedText style={styles.addPhotoLabel}>Thêm ảnh</ThemedText>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <View style={styles.stepContent}>
            <ThemedText type="defaultSemiBold" style={styles.reviewTitle}>
              Xem lại yêu cầu hoàn trả
            </ThemedText>
            <View style={styles.reviewSection}>
              <ThemedText style={styles.reviewLabel}>Sản phẩm hoàn trả</ThemedText>
              {Array.from(selectedItems.entries()).map(([id, qty]) => {
                const item = order.orderItems.find((i) => i.id === id);
                return (
                  <ThemedText key={id} style={styles.reviewItem}>
                    • {item?.itemName ?? id} (x{qty})
                  </ThemedText>
                );
              })}
            </View>
            <View style={styles.reviewSection}>
              <ThemedText style={styles.reviewLabel}>Lý do</ThemedText>
              <ThemedText>{reason}</ThemedText>
              {note ? <ThemedText style={styles.reviewNote}>{note}</ThemedText> : null}
            </View>
            {evidenceUris.length > 0 && (
              <View style={styles.reviewSection}>
                <ThemedText style={styles.reviewLabel}>Ảnh minh chứng ({evidenceUris.length})</ThemedText>
                <View style={styles.photoGrid}>
                  {evidenceUris.map((uri) => (
                    <Image key={uri} source={{ uri }} style={styles.reviewThumb} />
                  ))}
                </View>
              </View>
            )}
            {submitError && (
              <View style={styles.errorBox}>
                <ThemedText style={styles.errorText}>{submitError}</ThemedText>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Navigation buttons */}
      <View style={styles.footer}>
        <Pressable style={styles.backBtn} onPress={back} disabled={mutation.isPending}>
          <ThemedText>{step === 1 ? 'Đóng' : 'Quay lại'}</ThemedText>
        </Pressable>
        {step < TOTAL_STEPS ? (
          <Pressable
            style={[
              styles.nextBtn,
              ((step === 1 && !canProceedStep1) || (step === 2 && !canProceedStep2)) &&
                styles.nextBtnDisabled,
            ]}
            onPress={next}
            disabled={(step === 1 && !canProceedStep1) || (step === 2 && !canProceedStep2)}
          >
            <ThemedText style={styles.nextBtnText}>Tiếp theo</ThemedText>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.submitBtn, mutation.isPending && styles.nextBtnDisabled]}
            onPress={handleSubmit}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.nextBtnText}>Gửi yêu cầu</ThemedText>
            )}
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  progressBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ddd',
  },
  progressDotActive: { backgroundColor: '#007AFF' },
  scroll: { padding: 16, paddingBottom: 24 },
  stepContent: { gap: 12 },
  stepHint: { fontSize: 15, opacity: 0.7, marginBottom: 4 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  reasonRowSelected: { backgroundColor: '#f0f8ff' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ccc',
  },
  radioSelected: { borderColor: '#007AFF', backgroundColor: '#007AFF' },
  reasonLabel: { flex: 1, fontSize: 15 },
  noteInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
    marginTop: 4,
  },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoThumb: { width: 90, height: 90, borderRadius: 8, overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  removePhoto: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoText: { color: '#fff', fontSize: 11, lineHeight: 15 },
  addPhotoBtn: {
    width: 90,
    height: 90,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#ccc',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoPlus: { fontSize: 24, color: '#999', lineHeight: 28 },
  addPhotoLabel: { fontSize: 12, opacity: 0.5 },
  reviewTitle: { fontSize: 16, marginBottom: 8 },
  reviewSection: { backgroundColor: '#fff', borderRadius: 10, padding: 14, gap: 6 },
  reviewLabel: { fontSize: 13, opacity: 0.5, fontWeight: '600', textTransform: 'uppercase' },
  reviewItem: { fontSize: 14 },
  reviewNote: { fontSize: 13, opacity: 0.6, fontStyle: 'italic' },
  reviewThumb: { width: 70, height: 70, borderRadius: 6 },
  errorBox: {
    backgroundColor: '#fff0f0',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ffcccc',
  },
  errorText: { color: '#cc0000', fontSize: 14 },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e5e5',
    backgroundColor: '#fff',
  },
  backBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextBtn: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  submitBtn: {
    flex: 1,
    backgroundColor: '#34C759',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
});
