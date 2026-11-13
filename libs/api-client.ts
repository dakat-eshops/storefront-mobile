import { useCallback, useMemo } from "react";
import { useAuth } from "@/libs/auth/provider";
import { useConnectivityStore } from "./connectivity-store";
import { env } from "./env";
import { useDeviceAttestation } from "./device-attestation";

/**
 * No AbortController on the caller's side previously meant a stalled backend
 * hung the request indefinitely — indistinguishable from the device losing
 * its connection mid-request. This bounds it, matching the ceiling used on
 * the BO/FO web API clients (nestjsApiClient / serverApi).
 */
const REQUEST_TIMEOUT_MS = 15_000;

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
		this.name = "ApiError";
	}
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

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
	const reportReachable = useConnectivityStore((s) => s.reportReachable);
	const reportUnreachable = useConnectivityStore((s) => s.reportUnreachable);

	const basePath = useMemo(
		() =>
			`${env.apiBaseUrl}/${env.apiVersion}/fo-mobile/stores/${env.defaultStoreId}`,
		[],
	);

	const request = useCallback(
		async <T>(
			method: Method,
			path: string,
			body?: unknown,
			signal?: AbortSignal,
		): Promise<T> => {
			const url = `${basePath}${path}`;
			const payload = body !== undefined ? JSON.stringify(body) : undefined;

			const send = async (headers: Record<string, string>) => {
				// Combine the caller's signal (e.g. screen unmount) with our own
				// timeout — without a ceiling here, a stalled backend hangs
				// indefinitely and looks identical to the device losing its
				// connection mid-request.
				const timeoutController = new AbortController();
				const timeoutId = setTimeout(
					() => timeoutController.abort(),
					REQUEST_TIMEOUT_MS,
				);
				const onCallerAbort = () => timeoutController.abort();
				signal?.addEventListener("abort", onCallerAbort);
				try {
					const res = await fetch(url, {
						method,
						headers,
						body: payload,
						signal: timeoutController.signal,
					});
					// We got a response — the backend was reachable, even if it's
					// about to be turned into an ApiError for a non-2xx status.
					reportReachable();
					return res;
				} catch (err) {
					// The fetch itself never completed — DNS/TLS/connection-refused,
					// or our own timeout fired: a connectivity failure, not an
					// application error. Caller-initiated aborts (unmount) are not a
					// connectivity signal.
					if (!(signal?.aborted && (err as Error)?.name === "AbortError")) {
						reportUnreachable();
					}
					throw err;
				} finally {
					clearTimeout(timeoutId);
					signal?.removeEventListener("abort", onCallerAbort);
				}
			};

			const parse = async (res: Response): Promise<T> => {
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
			};

			const headers: Record<string, string> = {
				"Content-Type": "application/json",
				"x-app-version": env.appVersion,
				// IdentityMobileGuard's store fallback for routes without :storeId.
				"x-store-id": env.defaultStoreId,
			};
			const [jwt, attestation] = await Promise.all([
				getToken(),
				getAttestationToken(),
			]);
			if (jwt) headers.Authorization = `Bearer ${jwt}`;
			if (attestation) headers["x-device-attestation"] = attestation;

			const res = await send(headers);
			// A cached token can be revoked or expire server-side before its `exp`
			// (sign-out elsewhere, key rotation): re-mint once and retry.
			if (res.status === 401 && jwt) {
				const fresh = await getToken({ skipCache: true });
				if (fresh && fresh !== jwt) {
					return parse(
						await send({ ...headers, Authorization: `Bearer ${fresh}` }),
					);
				}
			}
			return parse(res);
		},
		[
			basePath,
			getToken,
			getAttestationToken,
			reportReachable,
			reportUnreachable,
		],
	);

	return useMemo(
		() => ({
			get: <T>(path: string, signal?: AbortSignal) =>
				request<T>("GET", path, undefined, signal),
			post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
			patch: <T>(path: string, body?: unknown) =>
				request<T>("PATCH", path, body),
			delete: <T>(path: string) => request<T>("DELETE", path),
		}),
		[request],
	);
}
