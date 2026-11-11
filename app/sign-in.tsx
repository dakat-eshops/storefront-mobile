import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { type SignInResult, useSignIn } from '@/libs/auth/provider';

/**
 * Email + password sign-in against the store's provider (BetterAuth by
 * default, Clerk for the exception store — libs/auth/). Accounts with
 * two-factor on (store admins) get a second step for the authenticator or a
 * backup code. Sign-up, social sign-in and password reset are not in the app
 * yet — docs/auth/README.md.
 */
export default function SignInScreen() {
  const scheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const { signInWithPassword, submitCode } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [needsCode, setNeedsCode] = useState(false);
  const [busy, setBusy] = useState(false);

  const handle = (result: SignInResult) => {
    if (result.status === 'signed-in') {
      router.back();
    } else if (result.status === 'needs-code') {
      setNeedsCode(true);
    } else {
      Alert.alert('Sign-in failed', result.message);
    }
  };

  const run = async (action: () => Promise<SignInResult>) => {
    setBusy(true);
    try {
      handle(await action());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('Sign-in failed', message);
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = [
    styles.input,
    { color: Colors[scheme].text, borderColor: Colors[scheme].icon },
  ];

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.body}>
        <ThemedText type="title">Sign in</ThemedText>
        {needsCode ? (
          <>
            <ThemedText>
              Enter the 6-digit code from your authenticator app, or a backup code.
            </ThemedText>
            <TextInput
              style={inputStyle}
              placeholder="Code"
              placeholderTextColor={Colors[scheme].icon}
              value={code}
              onChangeText={setCode}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              autoFocus
            />
            <Pressable
              disabled={busy || code.trim().length === 0}
              onPress={() => run(() => submitCode(code))}
              style={[styles.cta, { backgroundColor: Colors[scheme].tint }]}
            >
              <ThemedText style={styles.ctaText}>
                {busy ? 'Verifying…' : 'Verify'}
              </ThemedText>
            </Pressable>
          </>
        ) : (
          <>
            <TextInput
              style={inputStyle}
              placeholder="Email"
              placeholderTextColor={Colors[scheme].icon}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              autoComplete="email"
            />
            <TextInput
              style={inputStyle}
              placeholder="Password"
              placeholderTextColor={Colors[scheme].icon}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              autoComplete="current-password"
            />
            <Pressable
              disabled={busy}
              onPress={() => run(() => signInWithPassword(email.trim(), password))}
              style={[styles.cta, { backgroundColor: Colors[scheme].tint }]}
            >
              <ThemedText style={styles.ctaText}>
                {busy ? 'Signing in…' : 'Sign in'}
              </ThemedText>
            </Pressable>
          </>
        )}
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
