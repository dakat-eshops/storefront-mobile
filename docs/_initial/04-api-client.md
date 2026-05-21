# 04 · API Client — The HMAC Problem and the Mobile Gateway

**Read this before writing any networking code.** Misunderstanding this leads to either (a) shipping a guessable secret in the binary or (b) building a parallel backend.

## The constraint

The web FO authenticates to NestJS `/fo/*` routes with **two** signals:

1. **`BO_WEBHOOK_SECRET`** — a shared per-store secret. Computes `HMAC-SHA256(timestamp.storeId.body)` into the `x-signature` header. Stored as `stores.fo_api_secret` in Postgres, read by `StoreFoConfigService` on the web FO **server-side only**.
2. **Clerk JWT (optional)** — `Authorization: Bearer <jwt>` for personalized routes.

This works for web because the HMAC secret never leaves the Next.js server. The browser proxies through Next.js API routes, which then sign on the user's behalf.

**This pattern cannot work on mobile.** A mobile binary is:
- Statically analysable (`strings`, MobSF, Frida).
- Decompiled by anyone in <5 minutes.
- Cached in app stores, in user backups, on rooted devices.

If `BO_WEBHOOK_SECRET` ships in the binary, **any user can forge requests for any other user's store** until the secret is rotated — and rotation means force-upgrading every installed copy of the app.

## The solution — `/2026-01/fo-mobile/*` mobile gateway

Add a new path prefix to NestJS that authenticates **without HMAC**, using only Clerk + device attestation. `fo-mobile/` lives in the controller's `path`, never in `version`, mirroring the existing `/2026-01/fo/...` convention:

```
Web FO  → /2026-01/fo/...         (HMAC + optional Clerk)         ← unchanged
Mobile  → /2026-01/fo-mobile/...  (Clerk JWT + DeviceAttestation) ← NEW
BO      → /2026-01/...            (Supabase Bearer + INTERNAL_API_KEY)
```

Both `/fo/*` and `/fo-mobile/*` ultimately call the **same FO service classes** (`FoCatalogsService`, `FoProductsService`, etc.). The difference is only the controller layer: a different set of guards, but identical business logic and DTOs.

### NestJS controller (mobile)

> **`@Public()` is required on every `fo-mobile` controller (or per-method).** The global
> `ApiKeyGuard` skips paths starting with `/fo-mobile/` (see `api-key.guard.ts`), so
> `@Public()` is what tells the guard to pass through. Authentication is then handled
> exclusively by `ClerkMobileGuard` + `DeviceAttestationGuard`. Omitting `@Public()` means
> the guard will try to read `x-api-key` — which the mobile client never sends — and reject
> every request with `401 Missing API key` before your guards ever run.

```ts
// apps/api/src/modules/fo-mobile/products/fo-mobile-products.controller.ts
@Controller({ version: '2026-01', path: 'fo-mobile/stores/:storeId/products' })
@Public()                                   // ← REQUIRED: bypasses global ApiKeyGuard
@UseGuards(ClerkMobileGuard, DeviceAttestationGuard)
export class FoMobileProductsController {
  constructor(private readonly products: FoProductsService) {}    // ← same service the /fo/ controller uses

  @Get()
  async findMany(
    @Param('storeId') storeId: string,
    @Query() query: ListProductsDto,
    @Req() req: Request,
  ) {
    return this.products.findManyPublic({
      storeId,
      ...query,
      profileId: req.user?.profileId,  // present iff Clerk JWT was valid
    });
  }
}
```

The guards:

| Guard | Verifies |
| --- | --- |
| `ClerkMobileGuard` | Optional Clerk JWT. If header present, must be valid and not expired; resolves to `req.user`. If absent, allows the request to proceed as anonymous (sets `req.user = null`). |
| `DeviceAttestationGuard` | `x-device-attestation` header. iOS: App Attest. Android: Play Integrity. Rejects rooted/jailbroken devices and emulators in production. |
| Per-user rate limiter (interceptor) | Tighter than `/fo/*` since there's no HMAC throttle upstream. Use Redis token bucket keyed by `clerk_user_id` (or `device_id` for anonymous). |

### Device attestation (replaces HMAC's "this came from a legitimate origin" role)

HMAC on `/fo/*` proves "this request came from a server holding the per-store secret." For mobile, the analogue is "this request came from an unmodified copy of our app running on a real device."

- **iOS App Attest** (`expo-app-attest` or DCAppAttestService directly) — Apple-signed assertion that the app binary hash matches what Apple has on file.
- **Android Play Integrity** (`expo-play-integrity` or Google Play Integrity API directly) — Google-signed assertion about device + app integrity.

The NestJS guard verifies these signatures against Apple/Google's public keys. Forged headers are rejected. Replay is bounded by short-lived nonces.

Attestation is rate-limited per device (typically once per app launch or per N minutes). Cache the attestation token on-device and reuse it until expiry.

## Device attestation hook (custom native module)

Device attestation must be implemented as a **custom Expo native module** (config plugin) that wraps:

- **iOS** — Apple's [`DCAppAttestService`](https://developer.apple.com/documentation/devicecheck/establishing_your_app_s_integrity) (App Attest API)
- **Android** — Google's [Play Integrity API](https://developer.android.com/google/play/integrity)

There is no off-the-shelf npm package that wraps both under a single React Native API. You need a custom Expo plugin (see `apps/native/app-integrity/` in this repo). The API surface exposed by that module is:

```ts
// libs/device-attestation.ts
// Custom Expo native module — see apps/native/app-integrity/
// Wraps Apple DCAppAttestService (iOS) and Google Play Integrity (Android).
import {
  attestKey,
  generateKey,
  isSupported,
  requestIntegrityToken,
} from '@/libs/native/app-integrity';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL!;
const API_VERSION = process.env.EXPO_PUBLIC_API_VERSION!;

const KEY_ID_STORAGE = 'app-attest-key-id';
const CACHE_TTL_MS = 5 * 60 * 1000;          // re-attest at most every 5 minutes

type CachedAttestation = { token: string; expiresAt: number };

// Cached attestation key ID storage key for SecureStore
const ATTEST_CERT_STORAGE = 'app-attest-registered';

async function getOrCreateAppAttestKeyId(
  registerWithServer: (keyId: string, cert: string) => Promise<void>,
): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY_ID_STORAGE);
  if (existing) return existing;

  const keyId = await generateKey();
  // attestKey returns a DER-encoded attestation certificate signed by Apple.
  // It MUST be sent to your server (/fo-mobile/me/device-key) for key
  // registration — without this one-time step the DeviceAttestationGuard has
  // no key to verify against, and every subsequent assertion will fail.
  const cert = await attestKey(keyId, Application.applicationId ?? 'com.khanhstore.app');
  await registerWithServer(keyId, cert);

  // Only persist the key id after the server has accepted the registration.
  // If we persisted first and the server call failed, we'd silently skip
  // registration on the next launch.
  await SecureStore.setItemAsync(KEY_ID_STORAGE, keyId);
  await SecureStore.setItemAsync(ATTEST_CERT_STORAGE, 'registered');
  return keyId;
}

export function useDeviceAttestation() {
  const cacheRef = useRef<CachedAttestation | null>(null);

  // Called once per device lifetime to register the App Attest key with the
  // NestJS DeviceAttestationGuard. Must succeed before any attested request.
  const registerKey = useCallback(async (keyId: string, cert: string) => {
    const res = await fetch(
      `${API_BASE_URL}/${API_VERSION}/fo-mobile/me/device-key`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyId, cert }),
      },
    );
    if (!res.ok) throw new Error(`Device key registration failed: ${res.status}`);
  }, []);

  const getAttestation = useCallback(async (): Promise<string> => {
    if (!isSupported()) {
      // Simulators / unsupported devices — DeviceAttestationGuard must reject
      // '__unsupported__' in production (only allow in development builds).
      return '__unsupported__';
    }
    const now = Date.now();
    if (cacheRef.current && cacheRef.current.expiresAt > now) {
      return cacheRef.current.token;
    }
    // Server should provide a per-request nonce; for cache-friendly v1 use a
    // coarse time bucket (re-attests at most every CACHE_TTL_MS).
    const nonce = Math.floor(now / CACHE_TTL_MS).toString();
    let token: string;
    if (Platform.OS === 'ios') {
      const keyId = await getOrCreateAppAttestKeyId(registerKey);
      token = await requestIntegrityToken({ keyId, challenge: nonce });
    } else {
      token = await requestIntegrityToken({ nonce });
    }
    cacheRef.current = { token, expiresAt: now + CACHE_TTL_MS };
    return token;
  }, [registerKey]);

  return { getAttestation };
}
```

The NestJS `DeviceAttestationGuard` verifies these tokens against Apple App Attest and Google Play Integrity public keys. Production builds must reject `__unsupported__` and any expired / replayed nonce.

## Mobile API client implementation

```ts
// libs/api-client.ts
import { useAuth } from '@clerk/clerk-expo';
import { useDeviceAttestation } from '@/libs/device-attestation';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL!;
const API_VERSION = process.env.EXPO_PUBLIC_API_VERSION!;
const STORE_ID = process.env.EXPO_PUBLIC_DEFAULT_STORE_ID!;

class ApiError extends Error {
  constructor(public status: number, public body: string) {
    super(`API ${status}: ${body}`);
  }
}

export type ApiResponse<T> = { success: true; data: T } | { success: false; error: string };

export function useApiClient() {
  const { getToken } = useAuth();
  const { getAttestation } = useDeviceAttestation();

  async function request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    const [token, attestation] = await Promise.all([getToken(), getAttestation()]);
    const url = `${API_BASE_URL}/${API_VERSION}/fo-mobile/stores/${STORE_ID}${path}`;

    const res = await fetch(url, {
      method,
      signal,
      headers: {
        'Content-Type': 'application/json',
        'x-device-attestation': attestation,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    if (!res.ok) throw new ApiError(res.status, text);
    // FO services return ApiResponse<T> shape
    const parsed = JSON.parse(text) as ApiResponse<T>;
    if (!parsed.success) throw new ApiError(res.status, parsed.error);
    return parsed.data;
  }

  return {
    get: <T>(path: string, signal?: AbortSignal) => request<T>('GET', path, undefined, signal),
    post: <T>(path: string, body: unknown, signal?: AbortSignal) => request<T>('POST', path, body, signal),
    patch: <T>(path: string, body: unknown, signal?: AbortSignal) => request<T>('PATCH', path, body, signal),
    delete: <T>(path: string, signal?: AbortSignal) => request<T>('DELETE', path, undefined, signal),
  };
}
```

## Why not just put the HMAC secret in `EXPO_PUBLIC_HMAC_SECRET`?

It will work. It will pass code review the first time. It will ship to the store. And then the first person to run `strings` on your IPA / APK gets the keys to every store. There is no rotation strategy that doesn't brick every installed copy. This is a one-way door — don't open it.

## Why not use a backend-for-frontend (BFF) on the web FO that mobile proxies through?

You could route mobile → Next.js FO server → NestJS (mobile uses Next.js as a HMAC-signing relay). Two reasons not to:

1. **Latency.** Mobile users in Vietnam → Vercel edge in Singapore → NestJS in Singapore adds a hop, all for HMAC signing that no longer protects anything.
2. **Two failure modes.** Next.js outage now also kills the mobile app. The mobile app should depend on NestJS directly, not on web infrastructure.

The mobile gateway pattern (new NestJS controllers) costs one team-day of guard implementation and is the durable answer.

## Migration / coexistence

- `/fo/*` (HMAC) stays for the web FO. Do not change it.
- `/fo-mobile/*` is added incrementally. Start with read paths (products, catalogs, search) since they're the lowest-risk and unblock the entire shopping flow.
- Reuse FO service classes verbatim. The new controllers are 20–40 lines each.
- Reuse FO Zod DTOs. No new validation code.

## Request flow summary

```text
First launch (iOS — one-time key registration):
  Mobile app
    → generateKey()                              (custom native module)
    → attestKey(keyId, bundleId)                 (returns DER cert signed by Apple)
    → POST /2026-01/fo-mobile/me/device-key      { keyId, cert }
    → NestJS stores association; future assertions verified against this key

Every subsequent request:
  Mobile app
    → requestIntegrityToken({ keyId, challenge: nonce })   (iOS App Attest assertion)
    → requestIntegrityToken({ nonce })                     (Android Play Integrity token)
    → fetch /2026-01/fo-mobile/stores/:storeId/products
         headers:
           Authorization: Bearer <clerk_jwt>      (optional, set if signed in)
           x-device-attestation: <attestation>    (always)
    → NestJS (@Public() bypasses ApiKeyGuard)
         ClerkMobileGuard validates JWT (or marks anonymous)
         DeviceAttestationGuard verifies Apple/Google signature
         Rate limiter checks per-user/per-device budget
         → FoProductsService.findManyPublic(...)
    → Postgres (RLS enforces store/profile scoping as for web FO)
    → JSON response
```

Same backend, same business logic, mobile-safe auth.
