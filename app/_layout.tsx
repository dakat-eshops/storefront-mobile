import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { ClerkProvider, ClerkLoaded } from '@clerk/clerk-expo';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { tokenCache } from '@/libs/clerk-token-cache';
import { queryClient, persister } from '@/libs/query-client';
import { env } from '@/libs/env';

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
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </PersistQueryClientProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
