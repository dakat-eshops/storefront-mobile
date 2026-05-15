# 02 · Setup

## Prerequisites

- Node.js 20+, pnpm 9+
- Xcode 15+ (macOS only, for iOS builds)
- Android Studio + Android SDK 34
- Expo CLI: `pnpm dlx expo --version` (no global install needed)
- EAS CLI: `pnpm add -g eas-cli` (for production builds)

## Create the project

From `~/TheAstronaut/projects/e-commerce/FO/`:

```bash
pnpm create expo-app@latest KhanhStore-mobile --template default
cd KhanhStore-mobile
```

Pin the SDK in `package.json` (Expo SDK 53 = RN 0.79; bump to 54 once stable):

```json
{
  "dependencies": {
    "expo": "~53.0.0",
    "expo-router": "~5.0.0",
    "react": "19.0.0",
    "react-native": "0.79.x"
  }
}
```

> **Custom dev client required.** `react-native-app-integrity` (device attestation, see [04](04-api-client.md)) ships native code, so Expo Go cannot run this app. After `pnpm install`, run `pnpm expo prebuild` then `pnpm expo run:ios` / `pnpm expo run:android` to build a custom dev client, or use an EAS dev build.

## Required dependencies

```bash
pnpm add \
  @clerk/clerk-expo \
  @supabase/supabase-js \
  @tanstack/react-query @tanstack/query-async-storage-persister @tanstack/react-query-persist-client \
  @tanstack/react-db @tanstack/db @tanstack/query-db-collection \
  expo-router expo-secure-store expo-image expo-notifications expo-linking expo-constants \
  expo-application expo-device expo-crypto \
  react-native-mmkv \
  react-native-app-integrity \
  react-native-url-polyfill \
  zustand

pnpm add -D typescript @types/react eslint-config-expo
```

`@tanstack/query-db-collection` provides `queryCollectionOptions` (the authed cart/wishlist driver — same package the web FO uses). `react-native-app-integrity` wraps Apple App Attest + Google Play Integrity for the `DeviceAttestationGuard` on the mobile gateway.

`react-native-mmkv` is the storage driver for the TanStack Query persister and for guest cart/wishlist. It is ~30× faster than `AsyncStorage` and synchronous, which TanStack DB's localStorage-style driver expects.

## Project structure

```
KhanhStore-mobile/
├── app/                                # Expo Router (file-based routing)
│   ├── _layout.tsx                    # Root: ClerkProvider, QueryClientProvider, ThemeProvider
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── sign-in.tsx
│   │   └── sign-up.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx                  # Home
│   │   ├── search.tsx
│   │   ├── cart.tsx
│   │   └── account.tsx
│   ├── products/[slug].tsx
│   ├── catalogs/[catalogSlug]/index.tsx
│   ├── checkout/
│   │   ├── shipping.tsx
│   │   ├── payment.tsx
│   │   └── review.tsx
│   └── orders/[id].tsx
├── features/                           # Mirrors web FO feature dirs
│   ├── products/
│   │   ├── collections/
│   │   │   └── queryKeys.ts           # No electric.ts — mobile uses Broadcast, not Electric (see 06)
│   │   ├── hooks/
│   │   │   └── use-products.ts
│   │   └── components/
│   │       ├── ProductCard.tsx
│   │       └── ProductGrid.tsx
│   ├── cart/
│   ├── wishlist/
│   ├── orders/
│   └── ...
├── libs/
│   ├── api-client.ts                  # Mobile gateway client
│   ├── clerk-token-cache.ts           # SecureStore-backed Clerk cache
│   ├── supabase.ts                    # Broadcast subscriber (no DB client)
│   ├── realtime/
│   │   ├── inventory.ts
│   │   ├── prices.ts
│   │   ├── promotions.ts
│   │   └── catalog.ts
│   ├── query-client.ts                # TanStack Query + MMKV persister
│   ├── secure-store.ts
│   └── deep-links.ts
├── components/                         # Reusable RN-native components
├── constants/
│   ├── api.ts                          # API_BASE_URL, API_VERSION
│   └── colors.ts
├── types/                              # Re-export from @eshops/db (types only)
│   └── index.ts
├── app.config.ts                       # Expo config (dynamic, env-aware)
├── eas.json                            # EAS Build profiles
├── metro.config.js                     # Metro with monorepo support
├── tsconfig.json
└── package.json
```

## TypeScript paths

`tsconfig.json`:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./*"],
      "@eshops/db/types": ["../../BO/e-Shops/packages/db/src/index.ts"]
    }
  }
}
```

> The path alias points at `@eshops/db`'s barrel for type-only access. **Always use `import type` from `@eshops/db/types`** — never a value import. The Metro `blockList` below + an ESLint `no-restricted-imports` rule (`patterns: ['@eshops/db', '@eshops/db/!(types)']`) prevent runtime imports from sneaking in. The `packages/db/src/types.ts` file does not exist; `index.ts` re-exports the schema types we need.

If you instead publish `@eshops/db` to a private registry, add it via `pnpm add @eshops/db@workspace:*` only after you split the package into `@eshops/db` (runtime, Node) and `@eshops/db-types` (RN-safe types). The current package mixes both — RN must not consume it as-is.

## Environment variables

Expo exposes env vars prefixed with `EXPO_PUBLIC_` to the bundle. **Anything in `EXPO_PUBLIC_*` is shipped in the binary and inspectable by users — treat it as public.**

Create `.env`:

```bash
# Public (safe to bundle)
EXPO_PUBLIC_API_BASE_URL=https://api.eshops.example.com
EXPO_PUBLIC_API_VERSION=2026-01
EXPO_PUBLIC_DEFAULT_STORE_ID=<store-uuid>
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...   # anon key, RLS-gated — public is fine
EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT_NUMBER=123456789012   # required by Play Integrity (Android attestation)
EXPO_PUBLIC_APP_VERSION=1.0.0                          # used as TanStack Query cache buster on upgrade

# NEVER add these:
# FO_HMAC_SECRET                       — see 04-api-client.md
# INTERNAL_API_KEY                     — BO-only secret
# SUPABASE_SECRET_KEY                  — service role, never in mobile
# CLERK_SECRET_KEY                     — server-only
# ELECTRIC_SHAPE_SECRET                — BO-only
```

The Supabase **anon** key is safe in mobile because RLS gates every query and Realtime channels require auth for non-public events. The **service role** key is NEVER bundled.

## `app.config.ts` (dynamic config)

```ts
import type { ExpoConfig } from 'expo/config';

const profile = process.env.APP_PROFILE ?? 'development';

const config: ExpoConfig = {
  name: profile === 'production' ? 'KhanhStore' : `KhanhStore (${profile})`,
  slug: 'khanhstore',
  scheme: 'khanhstore',
  version: '1.0.0',
  ios: { bundleIdentifier: `com.khanhstore.app${profile === 'production' ? '' : `.${profile}`}` },
  android: { package: `com.khanhstore.app${profile === 'production' ? '' : `.${profile}`}` },
  plugins: ['expo-router', 'expo-secure-store', 'expo-notifications'],
  extra: { profile, eas: { projectId: '...' } },
};

export default config;
```

Separate iOS/Android bundle IDs per profile so dev, staging, and prod can coexist on a device.

## Metro config (monorepo-safe)

If you go with the workspace-link approach to `@eshops/db-types`:

```js
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;
// Block the runtime entrypoint of @eshops/db from RN bundles
config.resolver.blockList = [
  /BO\/e-Shops\/packages\/db\/src\/(?!types).*\.ts$/,
];

module.exports = config;
```

The `blockList` rule prevents anyone from accidentally importing a Drizzle table definition or `createDrizzleSupabaseClient` into the mobile bundle. The build will fail at bundle time, not at runtime in production.

## First run

```bash
pnpm install
pnpm expo start
# Press i for iOS simulator, a for Android emulator
```

Then proceed to [03-authentication.md](03-authentication.md).
