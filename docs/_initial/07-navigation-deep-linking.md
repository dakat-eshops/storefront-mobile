# 07 · Navigation & Deep Linking

Expo Router (file-based, same mental model as Next.js App Router). Universal links connect web URLs (`khanhstore.com/products/...`) directly to mobile screens — taps in email, social, push notifications, or messaging apps open the app if installed.

## Routing

Expo Router maps `app/products/[slug].tsx` to the route `/products/:slug`, matching the web FO's `app/products/[slug]/page.tsx`. Keep route shapes identical to web — it eliminates a class of cross-team bugs and unlocks Branch / Sendinblue / generic email campaigns that work for both surfaces.

```
app/
├── _layout.tsx
├── (auth)/
│   ├── _layout.tsx
│   ├── sign-in.tsx              → /sign-in
│   └── sign-up.tsx              → /sign-up
├── (tabs)/
│   ├── _layout.tsx              → bottom tabs
│   ├── index.tsx                → /
│   ├── search.tsx               → /search
│   ├── cart.tsx                 → /cart
│   └── account.tsx              → /account
├── products/
│   └── [slug].tsx               → /products/:slug
├── catalogs/[catalogSlug]/
│   ├── index.tsx                → /catalogs/:catalogSlug
│   └── categories/[categorySlug].tsx
├── checkout/
│   ├── _layout.tsx
│   ├── shipping.tsx
│   ├── payment.tsx
│   └── review.tsx
├── orders/[id].tsx              → /orders/:id
└── +not-found.tsx
```

## Deep link scheme

Configured in `app.config.ts`:

```ts
{
  scheme: 'khanhstore',
  ios: {
    bundleIdentifier: 'com.khanhstore.app',
    associatedDomains: ['applinks:khanhstore.com', 'applinks:www.khanhstore.com'],
  },
  android: {
    package: 'com.khanhstore.app',
    intentFilters: [{
      action: 'VIEW',
      autoVerify: true,
      data: [{ scheme: 'https', host: 'khanhstore.com' }],
      category: ['BROWSABLE', 'DEFAULT'],
    }],
  },
}
```

Two URL forms supported:

| Form | Used by |
| --- | --- |
| `khanhstore://products/abc` (custom scheme) | Push notifications, internal app links |
| `https://khanhstore.com/products/abc` (universal link) | Email, social, web → app handoff |

Universal links require:

- **iOS**: `apple-app-site-association` (AASA) file at `https://khanhstore.com/.well-known/apple-app-site-association`. Served by the web FO Next.js. Apple fetches it at app install.
- **Android**: `assetlinks.json` at `https://khanhstore.com/.well-known/assetlinks.json`. Google verifies at install + periodically.

Both files are JSON pointing at the app's signing identity. **Owned by the FO web repo**, not the mobile repo. Add them to `FO/KhanhStore/public/.well-known/` and configure Vercel to serve them with `Content-Type: application/json`.

## Web → app handoff

When the FO web detects a mobile user-agent on a product page, show a "Open in app" smart banner if the app is installed (iOS does this natively; Android requires `Intent` headers). This is a web-side concern — mobile just needs to handle the incoming deep link.

## Handling deep links in mobile

Expo Router parses deep links automatically when the URL shape matches the file-based routes. For state that can't be inferred from the URL (e.g., "open product `abc` AND prefill quantity 3"), use query params:

```
khanhstore://products/abc?qty=3
```

Then in `app/products/[slug].tsx`:

```tsx
import { useLocalSearchParams } from 'expo-router';

const { slug, qty } = useLocalSearchParams<{ slug: string; qty?: string }>();
```

## Auth-gated deep links

If a deep link lands on a screen that requires auth (e.g., `/orders/:id`), the route's layout should redirect to `/sign-in?redirect=/orders/:id` and then resume after sign-in:

```tsx
// app/orders/_layout.tsx
import { Redirect, Slot, usePathname } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';

export default function OrdersLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const pathname = usePathname();
  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href={`/(auth)/sign-in?redirect=${pathname}`} />;
  return <Slot />;
}
```

## Push-driven navigation

A push notification carries a `data.url` field (e.g., `khanhstore://orders/abc`). On tap:

```ts
// libs/notifications.ts
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

Notifications.addNotificationResponseReceivedListener((response) => {
  const url = response.notification.request.content.data?.url;
  if (typeof url === 'string') router.push(url);
});
```

See [08-push-notifications.md](08-push-notifications.md) for the full push flow.

## Anti-patterns

- ❌ Adding a `?token=...` param to a deep link to log a user in. Tokens in URLs are logged by every intermediate system (email, browser history, OS logs). Use Clerk session and explicit sign-in.
- ❌ Routing on `useEffect(() => router.push(...))` based on async state without a guard. Causes redirect loops on cold start.
- ❌ Diverging route shapes from web. If web has `/products/[slug]`, mobile must too.
