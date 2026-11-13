import { expoClient } from '@better-auth/expo/client';
import { twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';
import { env } from '@/libs/env';

/**
 * BetterAuth client for this store's FO deployment (the auth server is the FO
 * Next.js app at `${EXPO_PUBLIC_AUTH_BASE_URL}/api/auth`; one store per build).
 * Imported only by `provider.betterauth.tsx`.
 *
 * `expoClient` keeps the session cookie in SecureStore (Keychain / Keystore),
 * sends it plus `expo-origin: <scheme>://` on every auth call, and caches the
 * last session so an offline launch still knows who is signed in. The FO
 * server must trust the scheme: `BETTER_AUTH_MOBILE_ORIGINS=khanhstoremobile://`
 * (FO docs/auth/authentication/10-mobile-betterauth.md).
 */
export const authClient = createAuthClient({
  baseURL: env.authBaseUrl,
  plugins: [
    expoClient({ storagePrefix: 'storefront', storage: SecureStore }),
    // Admins with two-factor on get `twoFactorRedirect` at sign-in.
    twoFactorClient(),
  ],
});

/** Mint a NestJS Bearer JWT from the session (FO `GET /api/auth/token`). */
export async function mintNestJwt(): Promise<string | null> {
  const { data } = await authClient.$fetch<{ token: string }>('/token', {
    method: 'GET',
  });
  return data?.token ?? null;
}
