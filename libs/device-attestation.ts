import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '@clerk/clerk-expo';
import { env } from './env';

/**
 * Per-request device attestation.
 *
 * iOS  : App Attest (Apple)
 * Android: Play Integrity (Google)
 *
 * STATUS: SKELETON — the doc-referenced `react-native-app-integrity` package
 * is not on npm (404). Pick a replacement before shipping:
 *   - `expo-app-integrity` (preferred — Expo modules)
 *   - `@stoodi/expo-app-attest` + `@stoodi/expo-play-integrity`
 *   - Native modules via config plugins
 *
 * Until then, this hook returns `null` for the attestation header so the
 * request still goes out and NestJS will reject it with 401 — which is the
 * correct fail-closed behaviour for a security feature.
 *
 * See FO/KhanhStore/docs/react_native/04-api-client.md.
 */

const KEY_ID_STORAGE = 'app-attest-key-id';
const CACHE_TTL_MS = 5 * 60 * 1000;

type CachedToken = { token: string; expiresAt: number };

export function useDeviceAttestation() {
  const { getToken } = useAuth();
  const cacheRef = useRef<CachedToken | null>(null);

  /**
   * Returns an attestation token (base64) or null if unavailable.
   * Cached for CACHE_TTL_MS to avoid hammering the platform API on every request.
   */
  const getAttestationToken = useCallback(async (): Promise<string | null> => {
    const now = Date.now();
    if (cacheRef.current && cacheRef.current.expiresAt > now) {
      return cacheRef.current.token;
    }

    try {
      const challenge = await fetchChallenge(getToken);
      if (!challenge) return null;

      let token: string | null = null;
      if (Platform.OS === 'ios') {
        token = await generateIosAppAttestToken(challenge);
      } else if (Platform.OS === 'android') {
        token = await generateAndroidPlayIntegrityToken(challenge);
      }

      if (token) {
        cacheRef.current = { token, expiresAt: now + CACHE_TTL_MS };
      }
      return token;
    } catch (err) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[device-attestation] failed', err);
      }
      return null;
    }
  }, [getToken]);

  return { getAttestationToken };
}

/**
 * Ask NestJS for a fresh nonce/challenge to bind the attestation to.
 * Endpoint per doc: POST /fo-mobile/me/attest-challenge
 */
async function fetchChallenge(
  getToken: ReturnType<typeof useAuth>['getToken'],
): Promise<string | null> {
  const jwt = await getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;

  const res = await fetch(
    `${env.apiBaseUrl}/${env.apiVersion}/fo-mobile/me/attest-challenge`,
    { method: 'POST', headers },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { success: boolean; data?: { challenge: string } };
  return json.success ? json.data?.challenge ?? null : null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function generateIosAppAttestToken(_challenge: string): Promise<string | null> {
  // TODO: integrate replacement App Attest module. See file header.
  // 1. await getOrCreateAppAttestKeyId() via SecureStore (KEY_ID_STORAGE)
  // 2. registerKey() with NestJS POST /fo-mobile/me/device-key on first use
  // 3. attest the challenge → return base64 token
  await SecureStore.getItemAsync(KEY_ID_STORAGE).catch(() => null);
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function generateAndroidPlayIntegrityToken(_challenge: string): Promise<string | null> {
  // TODO: integrate Play Integrity via replacement module + cloudProjectNumber.
  // env.googleCloudProjectNumber is the Google Cloud project tied to Play Integrity API.
  return null;
}
