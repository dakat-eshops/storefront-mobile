# 01 · iOS App Attest

## Overview

[Apple App Attest](https://developer.apple.com/documentation/devicecheck/establishing-your-app-s-integrity) lets a NestJS server verify that API calls originate from an unmodified copy of your app on a genuine Apple device. This is the iOS equivalent of Play Integrity.

## Flow

```
1. App generates a key pair via DCAppAttestService (once per install, stored in Secure Enclave)
2. App sends public key to NestJS → server stores it + returns a nonce
3. App creates an attestation over (nonce + keyId) → sends to NestJS → server verifies with Apple
4. For subsequent requests: App generates an assertion (signature) using the attested key
5. NestJS verifies the assertion
```

## Implementation

### Key generation and attestation (one-time per install)

```ts
// libs/device-attestation.ts
import * as SecureStore from 'expo-secure-store';

const KEY_ID_STORE_KEY = 'app_attest_key_id';
const ATTESTATION_STORE_KEY = 'app_attest_attestation';

export async function getOrCreateAppAttestKeyId(): Promise<string> {
  const stored = await SecureStore.getItemAsync(KEY_ID_STORE_KEY);
  if (stored) return stored;

  const keyId = await ExpoDeviceAttestation.generateKey();   // uses DCAppAttestService
  await SecureStore.setItemAsync(KEY_ID_STORE_KEY, keyId);
  return keyId;
}

export async function ensureAttestedKey(keyId: string): Promise<void> {
  const existing = await SecureStore.getItemAsync(ATTESTATION_STORE_KEY);
  if (existing) return;   // already attested

  // Fetch server nonce
  const { nonce } = await api.post<{ nonce: string }>('/fo-mobile/device/attest/nonce');

  // Generate attestation (Apple verifies against nonce)
  const attestation = await ExpoDeviceAttestation.attest(keyId, nonce);

  // Send to NestJS for verification and storage
  await api.post('/fo-mobile/device/attest/verify', {
    keyId,
    attestation,      // base64-encoded Apple attestation object
    nonce,
  });

  await SecureStore.setItemAsync(ATTESTATION_STORE_KEY, 'attested');
}
```

### Assertion generation (per-request or cached)

```ts
// libs/device-attestation.ts

const TOKEN_CACHE_KEY = 'app_attest_assertion_cache';
const TOKEN_TTL_MS = 5 * 60 * 1000;   // 5 minutes

export async function getAttestationAssertion(): Promise<string | null> {
  // Platform guard
  if (Platform.OS !== 'ios') return null;

  // Check cache
  const cached = await SecureStore.getItemAsync(TOKEN_CACHE_KEY);
  if (cached) {
    const { assertion, expiresAt } = JSON.parse(cached);
    if (Date.now() < expiresAt) return assertion;
  }

  // Generate fresh assertion
  try {
    const keyId = await getOrCreateAppAttestKeyId();
    await ensureAttestedKey(keyId);

    // Server issues a fresh nonce for this assertion
    const { nonce } = await api.post<{ nonce: string }>('/fo-mobile/device/attest/nonce');
    const assertion = await ExpoDeviceAttestation.assert(keyId, nonce);

    // Cache it
    await SecureStore.setItemAsync(TOKEN_CACHE_KEY, JSON.stringify({
      assertion,
      nonce,
      expiresAt: Date.now() + TOKEN_TTL_MS,
    }));

    return assertion;
  } catch {
    return null;   // graceful degradation — NestJS decides whether to reject
  }
}
```

### Sending assertions with requests

```ts
// libs/api-client.ts
async function request<T>(method: string, path: string, options?: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${await getClerkToken()}`,
  };

  // Attach attestation assertion for write operations
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
    const assertion = await getAttestationAssertion();
    if (assertion) {
      headers['X-App-Attest-Assertion'] = assertion;
    }
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: JSON.stringify(options?.body) });
  return handleResponse<T>(res);
}
```

## NestJS verification

NestJS validates the assertion in `DeviceAttestationGuard` using the Apple App Attest API. The guard:

1. Reads `X-App-Attest-Assertion` header
2. Retrieves the stored `keyId` for this device (resolved via the authenticated Clerk JWT)
3. Verifies the assertion using `appleDeviceCheck.verifyAssertion(keyId, assertion, clientData)`
4. Rejects with `403` if invalid or nonce is expired

## Error states

| Code | Reason | Recovery |
| --- | --- | --- |
| `DCErrorDomain 1` | Key pair not found (app reinstall) | Clear stored keyId + re-attest |
| `DCErrorDomain 3` | Simulator (not supported) | Skip attestation — allow in dev only |
| `403` from NestJS | Invalid assertion | Clear cache + re-attest |
