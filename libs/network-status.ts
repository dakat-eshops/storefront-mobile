import * as Network from "expo-network";

/**
 * Device-level connectivity — "is there a network the OS thinks is up."
 * Distinct from `useBackendReachable()` (libs/connectivity-store.ts), which
 * tracks "did our last request actually get a response." A device can report
 * online while the backend is unreachable (DNS/TLS/timeout), and the two
 * cases need different UI copy — see docs/resilience/01-backend-outage-vs-device-offline.md.
 *
 * `isInternetReachable` mirrors `isConnected` on iOS (the OS gives no better
 * signal there); on Android it additionally accounts for a connected-but-no-
 * internet network (captive portal, router with no WAN). Treat either flag
 * being false as offline.
 */
export function useNetworkStatus(): { isOffline: boolean } {
	const state = Network.useNetworkState();
	const isOffline =
		state.isConnected === false || state.isInternetReachable === false;
	return { isOffline };
}
