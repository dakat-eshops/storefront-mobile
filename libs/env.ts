/**
 * Centralized typed env access.
 * All EXPO_PUBLIC_* vars are inlined at build time by Expo / Metro.
 */
export const env = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL!,
  apiVersion: process.env.EXPO_PUBLIC_API_VERSION ?? '2026-01',
  defaultStoreId: process.env.EXPO_PUBLIC_DEFAULT_STORE_ID!,
  clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!,
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  googleCloudProjectNumber: process.env.EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT_NUMBER,
  appVersion: process.env.EXPO_PUBLIC_APP_VERSION ?? '1.0.0',
  /** FO web origin (e.g. https://store.example.com). Used to build QR deep-links on the product screen. */
  foWebUrl: process.env.EXPO_PUBLIC_FO_WEB_URL ?? '',
} as const;

if (__DEV__) {
  const required = [
    'apiBaseUrl',
    'defaultStoreId',
    'clerkPublishableKey',
    'supabaseUrl',
    'supabaseAnonKey',
  ] as const;
  for (const key of required) {
    if (!env[key]) {
      // eslint-disable-next-line no-console
      console.warn(`[env] missing EXPO_PUBLIC_${key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`);
    }
  }
}
