import { useCallback, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { env } from './env';
import { useDeviceAttestation } from './device-attestation';

/**
 * Standard ApiResponse envelope shared with NestJS / FO web.
 * See FO/KhanhStore/CLAUDE.md → Cross-System Compatibility.
 */
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/**
 * Base path: /<version>/fo-mobile/stores/<storeId>
 *
 * Mobile uses the dedicated `fo-mobile/` path segment so NestJS can apply
 * mobile-specific guards (App Attest / Play Integrity verification) without
 * interfering with the existing `fo/` web routes.
 *
 * See docs/_initial/04-api-client.md.
 */
export function useApiClient() {
  const { getToken } = useAuth();
  const { getAttestationToken } = useDeviceAttestation();

  const basePath = useMemo(
    () => `${env.apiBaseUrl}/${env.apiVersion}/fo-mobile/stores/${env.defaultStoreId}`,
    [],
  );

  const request = useCallback(
    async <T>(method: Method, path: string, body?: unknown, signal?: AbortSignal): Promise<T> => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-app-version': env.appVersion,
      };

      const [jwt, attestation] = await Promise.all([getToken(), getAttestationToken()]);
      if (jwt) headers.Authorization = `Bearer ${jwt}`;
      if (attestation) headers['x-device-attestation'] = attestation;

      const url = `${basePath}${path}`;
      const res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal,
      });

      let parsed: ApiResponse<T> | undefined;
      try {
        parsed = (await res.json()) as ApiResponse<T>;
      } catch {
        // Non-JSON body — fall through with status info.
      }

      if (!res.ok || !parsed || parsed.success === false) {
        const message =
          parsed && parsed.success === false
            ? parsed.error
            : `${method} ${path} failed (${res.status})`;
        throw new ApiError(message, res.status, parsed);
      }

      return parsed.data;
    },
    [basePath, getToken, getAttestationToken],
  );

  return useMemo(
    () => ({
      get: <T>(path: string, signal?: AbortSignal) => request<T>('GET', path, undefined, signal),
      post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
      patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
      delete: <T>(path: string) => request<T>('DELETE', path),
    }),
    [request],
  );
}
