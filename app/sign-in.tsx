import { useSignIn } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Minimal email + password sign-in. Per docs/_initial/03-authentication.md
 * Clerk Expo SDK owns the session; we just call signIn.create + setActive.
 *
 * Sign-up, OAuth, and password reset live in future iterations; this screen
 * unblocks the cart-sync flow end-to-end.
 */
export default function SignInScreen() {
  const scheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const { signIn, setActive, isLoaded } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!isLoaded) return;
    setBusy(true);
    try {
      const attempt = await signIn.create({ identifier: email, password });
      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
        router.back();
      } else {
        Alert.alert('Sign-in incomplete', `Status: ${attempt.status}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('Sign-in failed', message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.body}>
        <ThemedText type="title">Sign in</ThemedText>
        <TextInput
          style={[
            styles.input,
            { color: Colors[scheme].text, borderColor: Colors[scheme].icon },
          ]}
          placeholder="Email"
          placeholderTextColor={Colors[scheme].icon}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        <TextInput
          style={[
            styles.input,
            { color: Colors[scheme].text, borderColor: Colors[scheme].icon },
          ]}
          placeholder="Password"
          placeholderTextColor={Colors[scheme].icon}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Pressable
          disabled={busy}
          onPress={onSubmit}
          style={[styles.cta, { backgroundColor: Colors[scheme].tint }]}
        >
          <ThemedText style={styles.ctaText}>
            {busy ? 'Signing in…' : 'Sign in'}
          </ThemedText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: 16, gap: 12 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  cta: { paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
