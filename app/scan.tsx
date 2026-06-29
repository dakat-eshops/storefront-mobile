import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, Stack } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/libs/api-client';
import { useResolveBarcode } from '@/features/products/hooks/use-products';

/**
 * Barcode scan screen — modal presentation.
 * Uses expo-camera CameraView with onBarcodeScanned.
 * On a successful read: resolves barcode → product slug → pushes product/[id].
 * On "not found" (NestJS returns success=false): shows error with retry.
 */
export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolveBarcode = useResolveBarcode();
  const cooldownRef = useRef(false);

  function handleBarcode({ data }: { data: string }) {
    if (scanned || cooldownRef.current) return;
    cooldownRef.current = true;
    setScanned(true);
    setResolving(true);
    setError(null);

    resolveBarcode(data)
      .then((result) => {
        const url = `/product/${result.slug}${result.variationId ? `?variation=${result.variationId}` : ''}`;
        router.replace(url as Parameters<typeof router.replace>[0]);
      })
      .catch((err: unknown) => {
        const message =
          err instanceof ApiError && err.message.toLowerCase().includes('no product')
            ? 'No product found for this barcode'
            : 'Could not resolve barcode — try again';
        setError(message);
        setResolving(false);
        setScanned(false);
        cooldownRef.current = false;
      });
  }

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator /></View>;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Stack.Screen options={{ title: 'Scan product', presentation: 'modal' }} />
        <Text style={styles.label}>Camera access is required to scan barcodes.</Text>
        <Pressable style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Allow camera</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Scan product', presentation: 'modal' }} />
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarcode}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'upc_a', 'ean8', 'upc_e', 'itf14', 'code128', 'qr'],
        }}
      />

      {/* Viewfinder overlay */}
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.frame} />
      </View>

      {/* Status / error */}
      <SafeAreaView edges={['bottom']} style={styles.footer}>
        {resolving && (
          <View style={styles.status}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.statusText}>Opening product…</Text>
          </View>
        )}
        {error && (
          <View style={styles.status}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              style={styles.retryBtn}
              onPress={() => { setError(null); setScanned(false); cooldownRef.current = false; }}
            >
              <Text style={styles.btnText}>Try again</Text>
            </Pressable>
          </View>
        )}
        {!resolving && !error && (
          <Text style={styles.hint}>Point the camera at the product barcode</Text>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 260,
    height: 160,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 32,
    paddingHorizontal: 24,
    gap: 12,
  },
  hint: { color: 'rgba(255,255,255,0.85)', fontSize: 14, textAlign: 'center' },
  status: { alignItems: 'center', gap: 8 },
  statusText: { color: '#fff', fontSize: 14 },
  errorText: { color: '#ff6b6b', fontSize: 14, textAlign: 'center' },
  label: { fontSize: 15, textAlign: 'center', marginBottom: 8 },
  btn: { backgroundColor: '#000', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnText: { color: '#fff', fontWeight: '600' },
});
