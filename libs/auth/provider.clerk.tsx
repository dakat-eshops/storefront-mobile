import {
  ClerkLoaded,
  ClerkProvider,
  useAuth as useClerkAuth,
  useSignIn as useClerkSignIn,
  useUser,
} from '@clerk/expo';
import { type ReactNode, useCallback, useMemo } from 'react';
import { tokenCache } from '@/libs/clerk-token-cache';
import { env } from '@/libs/env';
import type { AuthState, SignInApi, SignInResult } from './types';

/**
 * Clerk implementation of the app's auth surface — only for a store whose
 * `stores.auth_provider` is `clerk` (the Platform-Owner exception). Selected by
 * Metro when `EXPO_PUBLIC_AUTH_PROVIDER=clerk`. docs/auth/README.md.
 */

export function AuthRoot({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider tokenCache={tokenCache} publishableKey={env.clerkPublishableKey}>
      <ClerkLoaded>{children}</ClerkLoaded>
    </ClerkProvider>
  );
}

export function useAuth(): AuthState {
  const { isLoaded, isSignedIn, userId, getToken, signOut } = useClerkAuth();
  const { user } = useUser();

  const getNestToken = useCallback<AuthState['getToken']>(
    (options) => getToken({ skipCache: options?.skipCache }),
    [getToken],
  );
  const doSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  const displayName =
    user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? null;

  return useMemo(
    () => ({
      isLoaded,
      isSignedIn,
      userId: userId ?? null,
      displayName,
      getToken: getNestToken,
      signOut: doSignOut,
    }),
    [isLoaded, isSignedIn, userId, displayName, getNestToken, doSignOut],
  );
}

function clerkError(error: { longMessage?: string; message: string }): SignInResult {
  return { status: 'error', message: error.longMessage ?? error.message };
}

export function useSignIn(): SignInApi {
  const { signIn } = useClerkSignIn();
  return useMemo(
    () => ({
      // Clerk Core 3: methods resolve { error } instead of throwing, and
      // `signIn` reflects the updated attempt once they settle.
      async signInWithPassword(email, password) {
        const { error } = await signIn.password({ identifier: email, password });
        if (error) return clerkError(error);
        if (signIn.status !== 'complete') {
          return { status: 'error', message: `Sign-in incomplete (${signIn.status}).` };
        }
        const { error: finalizeError } = await signIn.finalize();
        return finalizeError ? clerkError(finalizeError) : { status: 'signed-in' };
      },
      async submitCode() {
        // Clerk's own MFA is not wired in this app.
        return { status: 'error', message: 'Two-step sign-in is not supported here.' };
      },
    }),
    [signIn],
  );
}
