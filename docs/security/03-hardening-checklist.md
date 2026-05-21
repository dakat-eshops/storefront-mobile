# 03 · Security Hardening Checklist

Pre-launch and ongoing security checklist for the mobile storefront.

## Secret hygiene

- **Never bundle server secrets in the binary.** `BO_WEBHOOK_SECRET`, `INTERNAL_API_KEY`, `ELECTRIC_SECRET`, Supabase service role key, and any BO/NestJS service secrets MUST NOT appear in `app.json`, `eas.json`, or any client-side env file.
- Use `EXPO_PUBLIC_*` only for truly public values (API base URL, Supabase anon key, store ID). Treat anything prefixed `EXPO_PUBLIC_` as readable by anyone with the APK/IPA.
- `expo-secure-store` for Clerk session tokens and device key IDs. Never AsyncStorage for sensitive values.
- Rotate Clerk secret keys and Supabase anon keys independently of mobile release cycles — the app reads them from `EXPO_PUBLIC_*` at build time.

## Certificate pinning

```ts
// Custom fetch wrapper — pin against known leaf or SPKI hash
const PINNED_CERTS = [
  'sha256/AAAA...=',   // production NestJS cert SPKI hash
  'sha256/BBBB...=',   // backup cert
];

// Use react-native-ssl-pinning or RNFETCHBLOB with cert pinning options
import { fetch } from 'react-native-ssl-pinning';

async function pinnedFetch(url: string, options: RequestInit) {
  return fetch(url, {
    ...options,
    sslPinning: {
      certs: ['production_nestjs_cert'],   // name in assets/
    },
  });
}
```

Cert pinning blocks MITM attacks where an attacker installs a custom CA. Update pinned certs at least 30 days before the current cert expires (use certificate transparency + monitoring to get advance notice).

## Jailbreak / root detection

```ts
// libs/device-attestation.ts
import JailMonkey from 'jail-monkey';

export function isDeviceCompromised(): boolean {
  if (__DEV__) return false;   // skip in dev
  return JailMonkey.isJailBroken() || JailMonkey.isOnExternalStorage();
}
```

**Rule**: Advisory, not a hard block. Log to Sentry with `tags.jailbroken = true`, show a warning dialog on first detection — do NOT refuse to load the app. Only consider blocking for high-risk operations (e.g., payment submission) after user research confirms acceptable drop-off rates.

## ProGuard / R8 (Android)

In `eas.json`:

```json
{
  "build": {
    "production": {
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:bundleRelease"
      }
    }
  }
}
```

In `android/app/build.gradle`:

```groovy
buildTypes {
  release {
    minifyEnabled true
    shrinkResources true
    proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
  }
}
```

ProGuard obfuscates class and method names, making reverse-engineering harder. Expo Managed Workflow enables this by default in production EAS builds.

## Replay protection

NestJS `DeviceAttestationGuard` enforces a 5-minute timestamp window on attestation tokens. If the token was issued more than 5 minutes ago:

- Reject with `403 STALE_TOKEN`
- Mobile clears the cached assertion and retries once before surfacing an error to the user

```ts
// In the guard
const tokenAgeMs = Date.now() - token.issuedAt;
if (tokenAgeMs > 5 * 60 * 1000) {
  throw new ForbiddenException('STALE_TOKEN');
}
```

## HTTPS enforcement

- All API calls MUST use HTTPS. Block HTTP via `android:usesCleartextTraffic="false"` in `AndroidManifest.xml` (Expo sets this by default in production).
- Supabase Realtime uses WSS (TLS-wrapped WebSocket) — the Supabase client enforces this automatically.

## Expo updates (OTA)

OTA updates via Expo Updates bypass app store review. Limit what can change via OTA:

- Never enable OTA in a way that could change security-critical native code (cert pinning, attestation flow)
- Consider `runtimeVersion` policies that require a new store submission when native modules change
- In production: `updates.checkAutomatically = "ON_LOAD"` with a reasonable fallback timeout (5s)

## Dependency auditing

```bash
# Run regularly in CI
pnpm audit --production
```

Flag any high or critical CVEs in auth, crypto, or network libraries. Do not ship with known high-severity vulnerabilities in `expo-secure-store`, `@clerk/clerk-expo`, or `react-native-ssl-pinning`.

## Summary table

| Hardening | iOS | Android | Priority |
| --- | --- | --- | --- |
| Secret hygiene | ✅ | ✅ | P0 |
| Clerk JWT (not shared secret) | ✅ | ✅ | P0 |
| HTTPS only | ✅ | ✅ | P0 |
| expo-secure-store for tokens | ✅ | ✅ | P0 |
| Device attestation (App Attest / Play Integrity) | ✅ iOS | ✅ Android | P1 |
| Replay protection (5-min nonce TTL) | ✅ | ✅ | P1 |
| Certificate pinning | ✅ | ✅ | P1 |
| Jailbreak / root detection (advisory) | ✅ | ✅ | P2 |
| ProGuard / R8 obfuscation | N/A | ✅ | P2 |
| OTA update restrictions | ✅ | ✅ | P2 |
| Dependency auditing (CI) | ✅ | ✅ | P2 |
