# 03 · Authentication (Clerk)

Same Clerk organization as the web FO. A user who signed up on the web can sign in on mobile and vice versa.

## Token cache (SecureStore)

Clerk needs a token cache to persist sessions across app launches. On RN, use `expo-secure-store` (Keychain on iOS, Keystore on Android — hardware-backed where available):

```ts
// libs/clerk-token-cache.ts
import * as SecureStore from 'expo-secure-store';
import type { TokenCache } from '@clerk/clerk-expo';

export const tokenCache: TokenCache = {
  async getToken(key) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key, value) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // SecureStore quota exceeded — clear and retry, or surface to logs
    }
  },
};
```

**Never** put Clerk tokens in `AsyncStorage` or MMKV without encryption — those stores are readable on rooted devices and from app backups.

## Provider

```tsx
// app/_layout.tsx
import { ClerkProvider, ClerkLoaded } from '@clerk/clerk-expo';
import { tokenCache } from '@/libs/clerk-token-cache';
import { Stack } from 'expo-router';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkLoaded>
        <Stack screenOptions={{ headerShown: false }} />
      </ClerkLoaded>
    </ClerkProvider>
  );
}
```

## Sign-in / sign-up

Use Clerk's prebuilt components OR roll your own with `useSignIn` / `useSignUp`. For Vietnam, the typical flow is phone (OTP) + email/password fallback. Configure providers in the Clerk dashboard — no code changes per provider.

```tsx
// app/(auth)/sign-in.tsx
import { useSignIn } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, Button, View } from 'react-native';

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (!isLoaded) return null;

  const onSubmit = async () => {
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(tabs)');
      }
    } catch (err) {
      // surface Clerk error code to the user (ClerkAPIResponseError)
    }
  };

  return (
    <View>
      <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" />
      <TextInput value={password} onChangeText={setPassword} secureTextEntry />
      <Button title="Sign in" onPress={onSubmit} />
    </View>
  );
}
```

## Accessing the session token (server requests)

Mobile gateway requests must forward the Clerk session token as `Authorization: Bearer <jwt>`. Get it via `useAuth().getToken()`:

```ts
// libs/api-client.ts (excerpt — full version in 04-api-client.md)
import { useAuth } from '@clerk/clerk-expo';

export function useApiClient() {
  const { getToken } = useAuth();
  return async <T>(path: string, init?: RequestInit): Promise<T> => {
    const token = await getToken();  // null when signed out
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
    if (!res.ok) throw new ApiError(res.status, await res.text());
    return res.json();
  };
}
```

Never call `getToken()` outside React (e.g., in a module-level constant) — Clerk's token rotates and the cached value goes stale. Always call it per request inside a hook or via `Clerk.session?.getToken()`.

## Guest mode

The mobile app **must** work signed-out for browse, search, and guest cart. Mobile gateway routes that don't require auth (product listing, search, public catalogs) accept anonymous requests — the `ClerkMobileGuard` decorates `@Public()` routes to skip auth. Guest cart and wishlist live in TanStack DB with an MMKV-backed driver, mirroring the web's `localStorageCollectionOptions` pattern. On sign-in, run the same sync-on-sign-in flow the web uses (POST guest items to `/cart/sync`, clear local, invalidate query). See [05-data-layer.md](05-data-layer.md).

## User sync to Postgres profile

The Clerk → Supabase profile sync webhook (`/api/webhooks/clerk` on the web FO) is the source of truth. It runs server-side and writes to `ProfileTable`. **Mobile does not duplicate this.** When a mobile user signs up:

1. Clerk creates the user on its own infra.
2. Clerk fires the webhook to the FO web's existing endpoint.
3. The webhook creates the `ProfileTable` row.
4. The mobile app reads its profile via `/2026-01/fo-mobile/me` (which queries the same `ProfileTable`).

This means: **after sign-up on mobile, `publicMetadata.profileId` may not exist yet for up to ~3 seconds.** Apply the same retry pattern the web uses for sync (5 retries × 3s — see `CartTanStackSyncProvider`) before bailing out.

## Sign-out

```tsx
import { useAuth } from '@clerk/clerk-expo';
const { signOut } = useAuth();
await signOut();
// also clear app-local caches that contain user-scoped data:
await queryClient.clear();
await cartCollection.clear();
await wishlistCollection.clear();
router.replace('/(auth)/sign-in');
```

Failing to clear the TanStack Query cache after sign-out is a privacy bug — the next user on the device will see the previous user's order history flash before refetch.

## Biometric reauth (later)

Use `expo-local-authentication` to gate sensitive screens (orders, payment methods, addresses) behind FaceID / TouchID. This is a UX wrapper — it does NOT replace Clerk; it adds a local lock on top of an active Clerk session. Out of scope for v1; add when needed.

## Anti-patterns

- ❌ Forwarding Clerk JWT from web → mobile via deep link. Phishable, and breaks Clerk session rotation.
- ❌ Calling Clerk REST API directly from RN with `CLERK_SECRET_KEY`. The secret key is server-only.
- ❌ Trusting `useAuth().userId` for permission checks — that's an identity claim, not an authorization decision. Authorization happens in NestJS via the same FO guard set.
- ❌ Storing Clerk tokens in MMKV/AsyncStorage. Use SecureStore.
