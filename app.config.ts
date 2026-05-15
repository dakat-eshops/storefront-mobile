import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Dynamic Expo config — extends app.json with runtime values from env.
 * See app.json for static manifest fields.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'KhanhStore',
  slug: config.slug ?? 'storefront-mobile',
  extra: {
    ...config.extra,
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    apiVersion: process.env.EXPO_PUBLIC_API_VERSION ?? '2026-01',
    defaultStoreId: process.env.EXPO_PUBLIC_DEFAULT_STORE_ID,
    clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    googleCloudProjectNumber: process.env.EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT_NUMBER,
    appVersion: process.env.EXPO_PUBLIC_APP_VERSION ?? '1.0.0',
  },
});
