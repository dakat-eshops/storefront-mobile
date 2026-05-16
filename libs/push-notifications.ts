import { useAuth } from '@clerk/clerk-expo';
import { useMutation } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useApiClient } from './api-client';
import { env } from './env';

/**
 * Expo push registration. Per docs/_initial/08-push-notifications.md:
 *
 *   1. Ask permission (idempotent — silently succeeds if already granted).
 *   2. Resolve the Expo push token via `getExpoPushTokenAsync({ projectId })`.
 *   3. POST it to `/fo-mobile/.../devices/push-token` keyed by Clerk profile.
 *
 * Notifications.setNotificationHandler MUST be called once at module load so
 * foreground notifications are surfaced as banners (the SDK suppresses them
 * by default). Set here rather than inside the hook to avoid re-registering
 * on every render.
 *
 * Skips on simulators / web (Expo push tokens are only issued to real devices).
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const next = await Notifications.requestPermissionsAsync();
    status = next.status;
  }
  if (status !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;

  try {
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return token.data;
  } catch {
    return null;
  }
}

/**
 * Mount once inside an authed scope (`isSignedIn === true`). Registers the
 * device's Expo push token with the BO so future order / cancel / return
 * events can target this device.
 */
export function usePushRegistration() {
  const { isSignedIn } = useAuth();
  const api = useApiClient();

  const register = useMutation({
    mutationFn: async () => {
      const token = await getExpoPushToken();
      if (!token) return { skipped: true as const };
      await api.post('/devices/push-token', {
        token,
        platform: Platform.OS as 'ios' | 'android',
        appVersion: env.appVersion,
      });
      return { skipped: false as const, token };
    },
    retry: 0,
  });

  const registerMutate = register.mutate;
  useEffect(() => {
    if (!isSignedIn) return;
    registerMutate();
  }, [isSignedIn, registerMutate]);
}
