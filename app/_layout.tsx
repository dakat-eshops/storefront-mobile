import { ClerkLoaded, ClerkProvider } from '@clerk/clerk-expo';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { CartSyncProvider } from '@/features/cart/components/cart-sync-provider';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { tokenCache } from '@/libs/clerk-token-cache';
import { env } from '@/libs/env';
import { PushRegistrationBootstrap } from '@/libs/push-registration-bootstrap';
import { persister, queryClient } from '@/libs/query-client';
import { RealtimeProvider } from '@/libs/realtime/realtime-provider';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ClerkProvider tokenCache={tokenCache} publishableKey={env.clerkPublishableKey}>
      <ClerkLoaded>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister, buster: env.appVersion }}
        >
          <CartSyncProvider>
            <RealtimeProvider>
              <PushRegistrationBootstrap>
                <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                  <Stack>
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="product/[id]" options={{ title: '' }} />
                    <Stack.Screen name="wishlist" options={{ title: 'Wishlist' }} />
                    <Stack.Screen name="orders" options={{ title: 'My Orders' }} />
                    <Stack.Screen
                      name="sign-in"
                      options={{ presentation: 'modal', title: 'Sign in' }}
                    />
                    <Stack.Screen
                      name="modal"
                      options={{ presentation: 'modal', title: 'Modal' }}
                    />
                  </Stack>
                  <StatusBar style="auto" />
                </ThemeProvider>
              </PushRegistrationBootstrap>
            </RealtimeProvider>
          </CartSyncProvider>
        </PersistQueryClientProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
