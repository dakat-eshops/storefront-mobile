import { useAuth, useUser } from '@clerk/clerk-expo';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function AccountScreen() {
  const scheme = useColorScheme() ?? 'light';
  const { isSignedIn, signOut } = useAuth();
  const { user } = useUser();

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Account</ThemedText>
      </ThemedView>
      <View style={styles.body}>
        {isSignedIn ? (
          <>
            <ThemedText style={styles.greeting}>
              {user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? 'Welcome'}
            </ThemedText>
            <Pressable
              onPress={() => signOut()}
              style={[styles.cta, styles.outlineCta, { borderColor: Colors[scheme].tint }]}
            >
              <ThemedText style={[styles.ctaText, { color: Colors[scheme].tint }]}>
                Sign out
              </ThemedText>
            </Pressable>
          </>
        ) : (
          <>
            <ThemedText style={styles.greeting}>
              Sign in to sync your cart and orders across devices.
            </ThemedText>
            <Link href="/sign-in" asChild>
              <Pressable style={[styles.cta, { backgroundColor: Colors[scheme].tint }]}>
                <ThemedText style={styles.ctaText}>Sign in</ThemedText>
              </Pressable>
            </Link>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  body: { padding: 16, gap: 16 },
  greeting: { fontSize: 16, lineHeight: 22 },
  cta: { paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  outlineCta: { backgroundColor: 'transparent', borderWidth: 1 },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
