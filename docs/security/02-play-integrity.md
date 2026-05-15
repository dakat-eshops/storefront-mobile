# 02 · Android Play Integrity

## Overview

[Google Play Integrity](https://developer.android.com/google/play/integrity/overview) verifies that Android API calls come from an unmodified app distributed through the Play Store, running on a genuine Android device.

## Flow

```
1. App requests an integrity token from the Play Integrity API
2. App sends the token to NestJS
3. NestJS sends the token to Google's verdict endpoint
4. Google returns a signed verdict with DEVICE_INTEGRITY, APP_INTEGRITY, ACCOUNT_DETAILS
5. NestJS enforces minimum verdict requirements
```

## Token generation

```ts
// libs/device-attestation.ts
import { Platform } from 'react-native';

const ANDROID_TOKEN_CACHE_KEY = 'play_integrity_token_cache';
const TOKEN_TTL_MS = 5 * 60 * 1000;

export async function getPlayIntegrityToken(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;

  // Check cache
  const cached = await SecureStore.getItemAsync(ANDROID_TOKEN_CACHE_KEY);
  if (cached) {
    const { token, expiresAt } = JSON.parse(cached);
    if (Date.now() < expiresAt) return token;
  }

  try {
    // Fetch server nonce (minimum 16 bytes, base64-encoded, URL-safe)
    const { nonce } = await api.post<{ nonce: string }>('/fo-mobile/device/play-integrity/nonce');

    // Request integrity token from Play Integrity API
    const token = await ExpoDeviceAttestation.requestPlayIntegrityToken(nonce);

    // Cache it
    await SecureStore.setItemAsync(ANDROID_TOKEN_CACHE_KEY, JSON.stringify({
      token,
      expiresAt: Date.now() + TOKEN_TTL_MS,
    }));

    return token;
  } catch {
    return null;
  }
}
```

The `api-client.ts` attaches this token in the same `X-Play-Integrity-Token` header for Android write requests. The `getAttestationAssertion` function is the iOS branch; `getPlayIntegrityToken` is the Android branch — the api-client dispatches based on `Platform.OS`.

## Verdict fields (NestJS verification)

NestJS decodes the Play Integrity verdict using Google's API. The relevant fields:

```ts
interface PlayIntegrityVerdict {
  requestDetails: {
    requestPackageName: string;       // must match your app's package name
    nonce: string;                    // must match the nonce sent by mobile
    timestampMillis: number;          // must be within the past 10 minutes
  };
  appIntegrity: {
    appRecognitionVerdict: 'PLAY_RECOGNIZED' | 'UNRECOGNIZED_VERSION' | 'UNEVALUATED';
    packageName: string;
    certificateSha256Digest: string[];
    versionCode: string;
  };
  deviceIntegrity: {
    deviceRecognitionVerdict: Array<'MEETS_DEVICE_INTEGRITY' | 'MEETS_BASIC_INTEGRITY' | 'MEETS_STRONG_INTEGRITY' | 'MEETS_VIRTUAL_INTEGRITY'>;
  };
  accountDetails: {
    appLicensingVerdict: 'LICENSED' | 'UNLICENSED' | 'UNEVALUATED';
  };
}
```

## Minimum requirements (NestJS guard)

```ts
// Minimum verdict to allow write operations
const MINIMUM_VERDICT = {
  appRecognitionVerdict: 'PLAY_RECOGNIZED',
  deviceRecognitionVerdict: ['MEETS_DEVICE_INTEGRITY'],   // at minimum
  appLicensingVerdict: 'LICENSED',
};
```

Sideloaded or unofficial APKs will fail `appRecognitionVerdict` and are rejected with `403`.

## Dev / debug builds

Play Integrity requires a signed release build distributed through the Play Store (or internal testing track). During development:

- In debug builds, skip attestation entirely (guarded by `__DEV__`)
- In development builds distributed via `eas build --profile development`, use `INTEGRITY_STANDARD` environment (less strict)
- Never use production integrity checking against a debug APK — it will always fail

```ts
if (__DEV__) {
  return null;   // skip attestation in Expo Go / debug builds
}
```

## NestJS error responses

| Verdict | Action |
| --- | --- |
| `UNEVALUATED` | Allow (Google didn't evaluate — treat as unknown) |
| `UNRECOGNIZED_VERSION` (app) | Reject 403 — app may be tampered |
| Missing `MEETS_DEVICE_INTEGRITY` | Reject 403 — device is emulated or rooted |
| `UNLICENSED` | Reject 403 — sideloaded build |
| Nonce mismatch | Reject 403 — replay attack |
| Token too old (>10 min) | Reject 403 — stale token |
