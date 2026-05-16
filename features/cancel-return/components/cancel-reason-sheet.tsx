import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';

const CANCEL_REASONS = [
  { key: 'changed_mind', label: 'Tôi đổi ý không muốn mua nữa' },
  { key: 'wrong_item', label: 'Tôi đặt nhầm sản phẩm' },
  { key: 'duplicate_order', label: 'Tôi đặt trùng đơn hàng' },
  { key: 'shipping_too_slow', label: 'Thời gian giao hàng quá lâu' },
  { key: 'other', label: 'Lý do khác' },
] as const;

type Props = {
  visible: boolean;
  isLoading: boolean;
  onConfirm: (reason: string, note?: string) => void;
  onCancel: () => void;
};

export function CancelReasonSheet({ visible, isLoading, onConfirm, onCancel }: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [customNote, setCustomNote] = useState('');

  function handleConfirm() {
    if (!selectedKey) return;
    const label = CANCEL_REASONS.find((r) => r.key === selectedKey)?.label ?? selectedKey;
    const note = selectedKey === 'other' && customNote.trim() ? customNote.trim() : undefined;
    onConfirm(label, note);
  }

  function handleClose() {
    setSelectedKey(null);
    setCustomNote('');
    onCancel();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ThemedText type="defaultSemiBold" style={styles.title}>
          Lý do hủy đơn hàng
        </ThemedText>
        <ScrollView style={styles.reasons} showsVerticalScrollIndicator={false}>
          {CANCEL_REASONS.map((reason) => (
            <Pressable
              key={reason.key}
              style={[styles.reasonRow, selectedKey === reason.key && styles.reasonRowSelected]}
              onPress={() => setSelectedKey(reason.key)}
            >
              <View style={[styles.radio, selectedKey === reason.key && styles.radioSelected]} />
              <ThemedText style={styles.reasonLabel}>{reason.label}</ThemedText>
            </Pressable>
          ))}
          {selectedKey === 'other' && (
            <TextInput
              style={styles.noteInput}
              placeholder="Nhập lý do của bạn..."
              value={customNote}
              onChangeText={setCustomNote}
              multiline
              maxLength={300}
              editable={!isLoading}
            />
          )}
        </ScrollView>
        <View style={styles.actions}>
          <Pressable style={styles.cancelBtn} onPress={handleClose} disabled={isLoading}>
            <ThemedText>Đóng</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.confirmBtn, !selectedKey && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={!selectedKey || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.confirmBtnText}>Xác nhận hủy</ThemedText>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 32,
    maxHeight: '70%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ccc',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    marginBottom: 16,
  },
  reasons: {
    flexGrow: 0,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  reasonRowSelected: {
    backgroundColor: '#f0f8ff',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ccc',
  },
  radioSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  reasonLabel: {
    flex: 1,
    fontSize: 15,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.4,
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
});
