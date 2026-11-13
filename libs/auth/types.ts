/**
 * Provider-agnostic auth surface for the app. Screens, hooks and the API
 * client import `@/libs/auth/provider`, never `@clerk/expo` or the BetterAuth
 * client directly. Metro points that specifier at `provider.betterauth.tsx`
 * (default) or `provider.clerk.tsx` from `EXPO_PUBLIC_AUTH_PROVIDER`, so a
 * build carries one provider only. docs/auth/README.md.
 */
export type GetToken = (options?: { skipCache?: boolean }) => Promise<string | null>;

export type AuthState = {
  /** False until the provider knows whether a session exists. */
  isLoaded: boolean;
  /** `undefined` while loading — the cart-sync transition relies on it. */
  isSignedIn: boolean | undefined;
  userId: string | null;
  /** Name, else email — for the account header. */
  displayName: string | null;
  /** NestJS Bearer JWT for the signed-in customer, or null. */
  getToken: GetToken;
  signOut: () => Promise<void>;
};

export type SignInResult =
  | { status: 'signed-in' }
  /** Admin accounts with two-factor on: ask for the authenticator code. */
  | { status: 'needs-code' }
  | { status: 'error'; message: string };

export type SignInApi = {
  signInWithPassword: (email: string, password: string) => Promise<SignInResult>;
  /** Finish a `needs-code` sign-in (TOTP or a backup code). */
  submitCode: (code: string) => Promise<SignInResult>;
};
