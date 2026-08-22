import { create } from "zustand";

/**
 * Tracks whether the most recent API request completed a round trip to the
 * backend, independent of device-level connectivity (libs/network-status.ts).
 *
 * `useApiClient` (libs/api-client.ts) reports every outcome here:
 *   - `reportUnreachable()` on a network-level failure — the fetch itself
 *     threw (DNS/TLS/connection refused) or our own request timeout fired.
 *     No response was ever received.
 *   - `reportReachable()` on ANY response, success or error status. Getting
 *     a 4xx/5xx still means the backend was reached — that's an application
 *     error, not a connectivity one, and deliberately doesn't set this flag.
 *
 * In-memory only (no persister) — this reflects "right now," not a fact
 * worth surviving an app restart.
 */
interface ConnectivityState {
	backendUnreachable: boolean;
	reportUnreachable: () => void;
	reportReachable: () => void;
}

export const useConnectivityStore = create<ConnectivityState>((set) => ({
	backendUnreachable: false,
	reportUnreachable: () => set({ backendUnreachable: true }),
	reportReachable: () => set({ backendUnreachable: false }),
}));

/** True when the last request failed at the network level (not an HTTP error status). */
export function useBackendUnreachable(): boolean {
	return useConnectivityStore((s) => s.backendUnreachable);
}
