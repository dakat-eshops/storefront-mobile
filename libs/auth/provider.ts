// Re-export shim. Metro (metro.config.js) resolves `@/libs/auth/provider` to
// `provider.betterauth.tsx` or `provider.clerk.tsx` from
// EXPO_PUBLIC_AUTH_PROVIDER at bundle time, so a build contains one provider.
// Only tsc resolves here; it type-checks against the default.
export { AuthRoot, useAuth, useSignIn } from './provider.betterauth';
export type { AuthState, GetToken, SignInApi, SignInResult } from './types';
