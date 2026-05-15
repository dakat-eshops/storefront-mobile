# 10 · Build & Deploy

EAS Build for native builds, EAS Update for OTA JS bundle updates, App Store Connect + Google Play Console for distribution.

## Profiles

`eas.json`:

```json
{
  "cli": { "version": ">= 10.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development",
      "env": { "APP_PROFILE": "development" }
    },
    "staging": {
      "distribution": "internal",
      "channel": "staging",
      "env": { "APP_PROFILE": "staging" },
      "ios": { "simulator": false },
      "android": { "buildType": "apk" }
    },
    "production": {
      "channel": "production",
      "env": { "APP_PROFILE": "production" },
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": { "appleId": "...", "ascAppId": "...", "appleTeamId": "..." },
      "android": { "serviceAccountKeyPath": "./play-store-key.json", "track": "internal" }
    }
  }
}
```

Three profiles match the BO + FO web environment strategy: `development` (auto), `staging` (manual QA approval), `production` (multi-approval + staged rollout).

## Environment matrix

| Profile | API base URL | Store ID | Clerk env |
| --- | --- | --- | --- |
| `development` | `https://dev-api.eshops.example.com` | dev store | Clerk dev instance |
| `staging` | `https://staging-api.eshops.example.com` | staging store | Clerk staging instance |
| `production` | `https://api.eshops.example.com` | prod store | Clerk prod instance |

EAS reads these from `.env.${APP_PROFILE}` files **at build time** — they're baked into the bundle. Anything that needs to rotate without a rebuild must come from a server endpoint at runtime.

## Native builds

```bash
# Cloud build (recommended — handles signing automatically)
eas build --profile staging --platform ios
eas build --profile production --platform all

# Local build (faster iteration, requires Xcode / Android Studio)
eas build --profile development --platform ios --local
```

First production iOS build prompts to create or upload a distribution certificate + provisioning profile — let EAS manage these.

## OTA updates (EAS Update)

Push JS-only changes (no native module changes) without a store review:

```bash
eas update --branch production --message "Fix VND formatting on cart"
```

OTA scope:

- ✅ JS / TypeScript code, including new screens (as long as no new native modules).
- ✅ Asset additions (images shipped in `assets/`).
- ❌ New Expo modules, new permissions, native config changes — those require a new build + store review.
- ❌ Security-critical changes that require revoking old binaries — OTA reaches only running apps; force-upgrade is needed for old versions.

Use **runtime versions** to gate OTA channels:

```ts
// app.config.ts
runtimeVersion: { policy: 'appVersion' }   // OTA only applies within the same app version
```

Bumping `version` (e.g., 1.2.0 → 1.3.0) creates a new runtime version; users on 1.2.x stop getting updates until they upgrade through the store. This prevents shipping JS that depends on native changes from a newer build to an older binary.

## Store submission

```bash
eas submit --profile production --platform ios
eas submit --profile production --platform android
```

**iOS**: TestFlight → external testing → App Review (24–48h typical) → release. Use phased release (1% → 100% over 7 days).

**Android**: Internal track → closed alpha → production. Use staged rollout (1% → 5% → 25% → 100%).

## Required store assets

| Asset | Spec |
| --- | --- |
| App icon | 1024×1024 PNG, no transparency, no rounded corners |
| iOS splash | 2732×2732 (universal) |
| Android adaptive icon | 1080×1080 foreground + background color |
| Screenshots | iPhone 6.7", 5.5"; iPad 12.9", 11"; Android phone, tablet |
| Privacy policy URL | Required — host on the FO web at `khanhstore.com/privacy` |
| Support URL | Required — `khanhstore.com/support` |

## App store privacy / data declarations

Both stores require declaring data collection. For a Vietnamese e-commerce app the typical declarations are:

- **Personal info**: Name, email, phone (from Clerk). Linked to user identity. Used for auth + order fulfillment.
- **Purchases**: Order history. Linked to identity. Used for app functionality.
- **Location**: Optional, only if shipping address autocomplete uses it. Linked or unlinked depending on opt-in.
- **Identifiers**: Device ID for push tokens. Linked to identity for transactional notifications.
- **Diagnostics**: Crash logs (Sentry). Unlinked.

Update declarations on every release that changes data flow.

## CI / CD

GitHub Actions workflow per branch:

```yaml
# .github/workflows/eas-build.yml
on:
  push:
    branches: [main, staging, develop]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: |
          if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
            eas build --profile production --platform all --non-interactive
            eas submit --profile production --platform all --non-interactive --no-wait
          elif [[ "${{ github.ref }}" == "refs/heads/staging" ]]; then
            eas build --profile staging --platform all --non-interactive
          fi
```

Mirror the BO + FO web branch protection rules: `develop` auto-deploys to dev, `staging` requires QA approval, `main` requires multi-approval + canary.

## Monitoring

| Layer | Tool | What to watch |
| --- | --- | --- |
| Crashes | Sentry (`@sentry/react-native`) | Crash-free session rate per build |
| Performance | Sentry Performance | API latency p50/p95, screen render times |
| OTA delivery | EAS Update dashboard | Update acceptance rate per channel |
| Push delivery | Expo Push receipts API | Bounced tokens — clean up `profile_push_tokens` rows |
| Backend errors | Existing NestJS Sentry | New `/fo-mobile/*` route 4xx/5xx rates |

## Rollback

- **JS-only regression** → `eas update --branch production --republish <previous-update-id>` reverts within minutes.
- **Native regression** → can't roll back binaries on Apple. Mitigate with phased release (catch in 1% before 100%) and runtime feature flags (a `featureFlag` payload from `/me/config` that disables the broken feature without a rebuild).

## Versioning

- `version` (semver) bumped per release.
- `buildNumber` (iOS) / `versionCode` (Android) auto-incremented by EAS.
- `runtimeVersion: { policy: 'appVersion' }` ties OTA scope to version.
- Same version string drives the `EXPO_PUBLIC_APP_VERSION` env var used by the TanStack Query persister buster.

## First release checklist

- [ ] App icon + splash assets created
- [ ] Privacy policy + support URLs live on web FO
- [ ] AASA + assetlinks.json deployed on `khanhstore.com/.well-known/` (verified via Apple's validator)
- [ ] Clerk production instance configured with mobile bundle IDs
- [ ] NestJS mobile gateway (`/fo-mobile/*`) live in staging
- [ ] Device attestation guards pass for a real device build
- [ ] Push tokens flowing end-to-end (sign up → token POST → DB row → test push received)
- [ ] Sentry production DSN configured per profile
- [ ] EAS production build passes
- [ ] TestFlight internal team has tested the full flow (sign up → browse → cart → checkout → order → cancel → refund)
- [ ] Apple + Google data declarations completed
- [ ] Staged rollout config set (1% iOS phased, 1% Android)
