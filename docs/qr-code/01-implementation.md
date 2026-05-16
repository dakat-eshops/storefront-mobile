# QR Code — storefront-mobile Implementation

## Install

```bash
pnpm add react-native-qrcode-svg
npx expo install expo-keep-awake
```

`react-native-svg` is already in the Expo 54 stack — no additional install needed.
No bare ejection required — Expo managed workflow compatible.

## File locations

```
features/orders/
├── components/
│   └── OrderQrCode.tsx        # QR display component (PascalCase — RN convention)
└── libs/
    └── qr.ts                  # Payload builder (same shape as KhanhStore)
```

## `libs/qr.ts`

```ts
// Shape must match BO/e-Shops/docs/qr-code/02-qr-payload-schema.md
type QrPayload = { v: 1; s: string; o: string; r: string };

export function buildOrderQrPayload(
  storeId: string,
  orderId: string,
  orderNumber: string,
): string {
  const payload: QrPayload = { v: 1, s: storeId, o: orderId, r: orderNumber };
  return JSON.stringify(payload);
}
```

Identical to the KhanhStore helper — safe to share as a copy.

## `OrderQrCode.tsx`

```tsx
import { View, Text, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useKeepAwake } from 'expo-keep-awake';
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
```

## Usage in order detail screen

```tsx
// app/(account)/orders/[orderId].tsx
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { OrderQrCode } from '@/features/orders/components/OrderQrCode';
import { useOrderDetail } from '@/features/orders/hooks/use-order-detail';

export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { data: order } = useOrderDetail(orderId);

  if (!order) return null;

  return (
    <ScrollView>
      {/* ...other order details... */}
      <View accessible accessibilityLabel={`QR code for order ${order.orderNumber}`}>
        <OrderQrCode
          storeId={order.storeId}
          orderId={order.id}
          orderNumber={order.orderNumber}
        />
      </View>
    </ScrollView>
  );
}
```

## Error correction level (`ecl`)

| Value | Recovery | Use when |
|-------|----------|---------|
| `'L'` | 7% | Clean screen, good lighting |
| `'M'` (default) | 15% | General on-screen use |
| `'Q'` | 25% | Cracked or dirty screen |
| `'H'` | 30% | Printed QR with logo overlay |

## Size guidelines

| Device | `size` |
|--------|--------|
| Small phone (< 375pt) | `180` |
| Standard phone | `200` |
| Large phone / tablet | `240` |

## Dark mode

The device theme must NOT affect QR colors. `backgroundColor="#ffffff"` and `color="#09090b"` are hardcoded constants — never derive them from a theme token or `useColorScheme()`.

## `expo-keep-awake`

`useKeepAwake()` prevents the screen from auto-dimming while the QR is mounted. It releases automatically when the component unmounts (user navigates away). No manual cleanup needed.

## Jest mock

```ts
jest.mock('react-native-qrcode-svg', () => 'QRCode');
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));
```

## TypeScript

`react-native-qrcode-svg` ships its own types. If TypeScript reports a missing module, add to `tsconfig.json`:
```json
{ "compilerOptions": { "types": ["react-native-qrcode-svg"] } }
```
This is rarely needed with Expo 54 + TypeScript 5.
