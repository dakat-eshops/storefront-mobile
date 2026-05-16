import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { orderQueryKeys } from '@/features/orders/collections/queryKeys';
import { profileQueryKeys } from '@/features/profile/collections/queryKeys';
import { queryClient } from './query-client';

// Tell Expo how to present notifications when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type PushData = Record<string, unknown>;

function handleOrderNavigation(data: PushData) {
  const orderId = data.orderId as string | undefined;
  if (!orderId) return;
  queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(orderId) });
  router.push(`/orders/${orderId}`);
}

/**
 * Register all notification listeners. Call once from the root _layout.tsx
 * useEffect after ClerkLoaded (router is ready at that point).
 * Returns a cleanup function to remove the listeners.
 */
export function registerNotificationHandlers(): () => void {
  // Foreground: notification arrives while app is open
  const foregroundSub = Notifications.addNotificationReceivedListener((notification) => {
    const data = notification.request.content.data as PushData;
    const type = data.type as string | undefined;

    if (type === 'cancel_status_update' || type === 'return_status_update') {
      const orderId = data.orderId as string | undefined;
      if (orderId) {
        queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(orderId) });
        // Invalidate profile if a refund was issued (loyalty balance may have changed)
        const status = data.status as string | undefined;
        if (status === 'refund_issued' || type === 'cancel_status_update') {
          queryClient.invalidateQueries({ queryKey: profileQueryKeys.detail() });
        }
      }
    }

    if (
      type === 'order_confirmed' ||
      type === 'order_shipped' ||
      type === 'order_delivered' ||
      type === 'order_cancelled'
    ) {
      const orderId = data.orderId as string | undefined;
      if (orderId) {
        queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(orderId) });
      }
    }
  });

  // Background / killed: user taps the notification to open the app
  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as PushData;
    const type = data.type as string | undefined;

    switch (type) {
      case 'cancel_status_update': {
        queryClient.invalidateQueries({ queryKey: profileQueryKeys.detail() }); // loyalty balance
        handleOrderNavigation(data);
        break;
      }
      case 'return_status_update': {
        const status = data.status as string | undefined;
        if (status === 'refund_issued') {
          queryClient.invalidateQueries({ queryKey: profileQueryKeys.detail() });
        }
        handleOrderNavigation(data);
        break;
      }
      case 'order_confirmed':
      case 'order_shipped':
      case 'order_delivered':
      case 'order_cancelled': {
        handleOrderNavigation(data);
        break;
      }
    }
  });

  return () => {
    foregroundSub.remove();
    responseSub.remove();
  };
}
