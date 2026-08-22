import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBackendUnreachable } from "@/libs/connectivity-store";
import { useNetworkStatus } from "@/libs/network-status";

/**
 * Two distinct states that look the same to a user but need different
 * copy — see docs/resilience/01-backend-outage-vs-device-offline.md.
 *
 * Device offline is checked first: if the device itself has no connection,
 * classifying the *last* request's failure type is noise — of course it
 * failed at the network level, that's what "offline" means.
 */
export function ConnectivityBanner() {
	const { isOffline } = useNetworkStatus();
	const backendUnreachable = useBackendUnreachable();
	const insets = useSafeAreaInsets();

	if (!(isOffline || backendUnreachable)) return null;

	const message = isOffline
		? "You're offline — showing saved data."
		: "Having trouble reaching the server — showing saved data.";

	return (
		<View style={[styles.container, { paddingTop: insets.top + 6 }]}>
			<Text style={styles.text}>{message}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		backgroundColor: "#B45309", // amber-700 — visible in both light/dark, not alarm-red
		paddingBottom: 6,
		paddingHorizontal: 16,
	},
	text: {
		color: "#FFFBEB",
		fontSize: 13,
		fontWeight: "500",
		textAlign: "center",
	},
});
