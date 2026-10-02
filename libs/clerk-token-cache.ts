import * as SecureStore from 'expo-secure-store';
import type { TokenCache } from '@clerk/clerk-expo';

/**
 * Clerk token cache backed by Expo SecureStore (iOS Keychain / Android Keystore).
 * See docs/_initial/03-authentication.md.
 */
export const tokenCache: TokenCache = {
  async getToken(key) {
    try {
      const item = await SecureStore.getItemAsync(key);
      return item ?? null;
    } catch {
      // SecureStore may throw if device storage is unavailable.
      return null;
    }
  },
  async saveToken(key, token) {
    try {
      await SecureStore.setItemAsync(key, token);
    } catch {
      // Silent — Clerk will retry on next session refresh.
    }
  },
};
