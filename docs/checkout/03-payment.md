# 03 · Payment Selection

The payment selection screen is covered end-to-end in [../payments/04-mobile-flow.md](../payments/04-mobile-flow.md). This document covers only the UI layer of the payment screen within the checkout flow.

## Screen layout

```text
┌─────────────────────────────────────┐
│  Phương thức thanh toán             │
│  (Payment method)                   │
├─────────────────────────────────────┤
│  ● Thanh toán khi nhận hàng (COD)  │  ← default selected
│  ○ Chuyển khoản ngân hàng           │
│  ○ MoMo                             │
│  ○ ZaloPay                          │
│  ○ VNPay                            │
└─────────────────────────────────────┘
  [Tiếp tục →]
```

Only show methods returned by the store's `payment_methods` config. COD MUST always appear first.

## Component

```tsx
// features/checkout/components/payment-method-selector.tsx
import { useCheckoutStore } from '../store';
import { usePaymentMethods } from '../hooks/use-payment-methods';

export function PaymentMethodSelector() {
  const { paymentMethod, setPaymentMethod } = useCheckoutStore();
  const { data: methods = [] } = usePaymentMethods();

  return (
    <FlatList
      data={methods}
      keyExtractor={(m) => m.key}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => setPaymentMethod(item)}
          style={styles.methodRow}
          accessibilityRole="radio"
          accessibilityState={{ checked: paymentMethod?.key === item.key }}
        >
          <RadioCircle selected={paymentMethod?.key === item.key} />
          <PaymentMethodIcon method={item.key} size={24} />
          <Text style={styles.methodName}>{item.displayName}</Text>
        </Pressable>
      )}
    />
  );
}
```

## Wallet detection (optional enhancement)

Check if the wallet app is installed to show a "Not installed" warning:

```ts
import { Linking } from 'react-native';

async function isMoMoInstalled(): Promise<boolean> {
  return Linking.canOpenURL('momo://');
}
```

If not installed, show a VietQR badge next to the method name as fallback indicator.

## Continuing to review

The "Continue" button is enabled as soon as a payment method is selected. On press, push `/checkout/review`.

```ts
<Button
  disabled={!paymentMethod}
  onPress={() => router.push('/checkout/review')}
>
  Tiếp tục
</Button>
```

## Cross-references

- [../payments/01-overview.md](../payments/01-overview.md) — Payment method support matrix
- [../payments/04-mobile-flow.md](../payments/04-mobile-flow.md) — End-to-end payment intent + gateway flows
