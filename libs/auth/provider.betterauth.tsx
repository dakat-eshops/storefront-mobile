import { type ReactNode, useCallback, useEffect, useMemo } from 'react';
import { authClient, mintNestJwt } from './better-auth-client';
import { createTokenCache } from './jwt-cache';
import type { AuthState, SignInApi, SignInResult } from './types';

/**
 * BetterAuth implementation of the app's auth surface (default provider).
 * Selected by Metro when `EXPO_PUBLIC_AUTH_PROVIDER` is unset or `betterauth`.
 * docs/auth/README.md.
 */

/** One token cache per app process; cleared whenever the user changes. */
const tokenCache = createTokenCache(mintNestJwt);

/** No provider component needed — the session lives in BetterAuth's store. */
export function AuthRoot({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  fullName?: string | null;
};

export function useAuth(): AuthState {
  const { data, isPending } = authClient.useSession();
  const user = (data?.user ?? null) as SessionUser | null;
  const userId = user?.id ?? null;

  // A different user (or none) must never reuse the previous user's token.
  useEffect(() => {
    tokenCache.clear();
  }, [userId]);

  const getToken = useCallback<AuthState['getToken']>(
    async (options) => (userId ? tokenCache.get(options) : null),
    [userId],
  );

  const signOut = useCallback(async () => {
    tokenCache.clear();
    await authClient.signOut();
  }, []);

  return useMemo(
    () => ({
      isLoaded: !isPending,
      isSignedIn: isPending ? undefined : Boolean(userId),
      userId,
      displayName: user?.fullName || user?.name || user?.email || null,
      getToken,
      signOut,
    }),
    [isPending, userId, user?.fullName, user?.name, user?.email, getToken, signOut],
  );
}

type AuthError = { code?: string; status?: number; message?: string } | null;

function errorResult(error: AuthError): SignInResult {
  if (error?.code === 'EMAIL_NOT_VERIFIED') {
    return {
      status: 'error',
      message: 'Please verify your email first — we sent you a link.',
    };
  }
  if (error?.status === 429) {
    return { status: 'error', message: 'Too many attempts. Please try again in a minute.' };
  }
  if (error?.code === 'INVALID_EMAIL_OR_PASSWORD') {
    return { status: 'error', message: 'Wrong email or password.' };
  }
  if (error?.code === 'INVALID_CODE' || error?.code === 'INVALID_BACKUP_CODE') {
    return { status: 'error', message: 'That code is not right.' };
  }
  return { status: 'error', message: error?.message ?? 'Sign-in failed. Please try again.' };
}

export function useSignIn(): SignInApi {
  return useMemo(
    () => ({
      async signInWithPassword(email, password) {
        const { data, error } = await authClient.signIn.email({ email, password });
        if (error) return errorResult(error);
        if (data && 'twoFactorRedirect' in data && data.twoFactorRedirect) {
          return { status: 'needs-code' };
        }
        return { status: 'signed-in' };
      },
      async submitCode(code) {
        const trimmed = code.trim();
        const { error } = /^\d{6}$/.test(trimmed)
          ? await authClient.twoFactor.verifyTotp({ code: trimmed })
          : await authClient.twoFactor.verifyBackupCode({ code: trimmed });
        return error ? errorResult(error) : { status: 'signed-in' };
      },
    }),
    [],
  );
}
