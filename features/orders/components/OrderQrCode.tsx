import { useKeepAwake } from 'expo-keep-awake';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { buildOrderQrPayload } from '@/libs/qr';

type Props = {
  storeId: string;
  orderId: string;
  orderNumber: string;
  size?: number;
};

export function OrderQrCode({ storeId, orderId, orderNumber, size = 200 }: Props) {
  // Keep screen on while QR is displayed — auto-released on unmount
  useKeepAwake();

  const value = buildOrderQrPayload(storeId, orderId, orderNumber);

  return (
    <View style={styles.container}>
      <Text style={styles.brightnessHint}>
        Increase your screen brightness for easier scanning.
      </Text>
      <View style={styles.qrWrapper}>
        {/* Always white bg regardless of device theme — scanners need high contrast */}
        <QRCode
          value={value}
          size={size}
          color="#09090b"
          backgroundColor="#ffffff"
          ecl="M"
        />
      </View>
      <Text style={styles.orderRef}>{orderNumber}</Text>
      <Text style={styles.hint}>Show this to staff to look up your order instantly</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 12,
  },
  brightnessHint: {
    fontSize: 12,
    color: '#a1a1aa',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  qrWrapper: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  orderRef: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: '#71717a',
  },
  hint: {
    fontSize: 12,
    color: '#a1a1aa',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
