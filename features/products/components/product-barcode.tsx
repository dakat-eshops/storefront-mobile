import Barcode from 'react-native-barcode-svg';
import QRCode from 'react-native-qrcode-svg';
import { StyleSheet, Text, View } from 'react-native';

/** Mirrors barcodeFormatFor() from @eshops/db (packages/db/src/utils/barcodeUtils.ts). */
function barcodeFormatFor(value: string): string {
  if (/^\d{13}$/.test(value)) return 'EAN13';
  if (/^\d{12}$/.test(value)) return 'UPCA';
  if (/^\d{8}$/.test(value)) return 'EAN8';
  if (/^\d{14}$/.test(value)) return 'ITF14';
  return 'CODE128';
}

type ProductBarcodeProps = {
  /** GTIN or Code128 barcode value. Renders nothing when null/empty. */
  barcode: string | null | undefined;
  /** Canonical public PDP URL encoded in the self-QR. */
  pdpUrl: string;
};

/**
 * Barcode + QR display for the FO mobile product screen.
 *
 * - 1D barcode: react-native-barcode-svg, auto-symbology.
 * - Self-QR: react-native-qrcode-svg encoding the PDP URL.
 * - Always white bg / black bars for scanner contrast.
 * - Renders nothing when barcode is null/empty.
 */
export function ProductBarcode({ barcode, pdpUrl }: ProductBarcodeProps) {
  if (!barcode) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{barcode}</Text>

      <View style={styles.barcodeWrap}>
        <Barcode
          value={barcode}
          format={barcodeFormatFor(barcode)}
          // react-native-barcode-svg's real prop names — `background` / `width`
          // were silently ignored. The human-readable value is the <Text> above.
          backgroundColor="white"
          lineColor="#000000"
          singleBarWidth={1.5}
          height={60}
        />
      </View>

      <View style={styles.qrWrap}>
        <QRCode value={pdpUrl} size={120} backgroundColor="white" color="#000000" />
        <Text style={styles.qrHint}>Scan to open</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    alignItems: 'flex-start',
    gap: 12,
  },
  label: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  barcodeWrap: {
    backgroundColor: '#ffffff',
    padding: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    borderRadius: 6,
  },
  qrWrap: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    alignItems: 'center',
    gap: 4,
  },
  qrHint: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 4,
  },
});
