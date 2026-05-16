import { Stack } from 'expo-router';

export default function OrderLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: '' }} />
      <Stack.Screen name="cancel" options={{ presentation: 'modal', title: 'Hủy đơn hàng' }} />
      <Stack.Screen name="return" options={{ presentation: 'modal', title: 'Yêu cầu hoàn trả' }} />
    </Stack>
  );
}
