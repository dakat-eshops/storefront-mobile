import { useAuth, useUser } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import { Link, router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/libs/supabase';

export default function AccountScreen() {
  const scheme = useColorScheme() ?? 'light';
  const { isSignedIn, signOut } = useAuth();
  const { user } = useUser();
  const tint = Colors[scheme].tint;
  const queryClient = useQueryClient();

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Account</ThemedText>
        {isSignedIn ? (
          <ThemedText style={styles.greeting}>
            {user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? 'Welcome'}
          </ThemedText>
        ) : null}
      </ThemedView>

      <View style={styles.menu}>
        <MenuRow href="/orders" label="My Orders" icon="paperplane.fill" tint={tint} />
        <MenuRow href="/wishlist" label="Wishlist" icon="heart.fill" tint={tint} />
      </View>

      <View style={styles.footer}>
        {isSignedIn ? (
          <Pressable
            onPress={async () => {
              await supabase.removeAllChannels();
              queryClient.clear();
              await signOut();
              router.replace('/sign-in');
            }}
            style={[styles.cta, styles.outline, { borderColor: tint }]}
          >
            <ThemedText style={[styles.ctaText, { color: tint }]}>Sign out</ThemedText>
          </Pressable>
        ) : (
          <Link href="/sign-in" asChild>
            <Pressable style={[styles.cta, { backgroundColor: tint }]}>
              <ThemedText style={styles.ctaText}>Sign in</ThemedText>
            </Pressable>
          </Link>
        )}
      </View>
    </SafeAreaView>
  );
}

function MenuRow({
  href,
  label,
  icon,
  tint,
}: {
  href: '/orders' | '/wishlist';
  label: string;
  icon: 'paperplane.fill' | 'heart.fill';
  tint: string;
}) {
  return (
    <Link href={href} asChild>
      <Pressable style={styles.row}>
        <IconSymbol name={icon} size={20} color={tint} />
        <ThemedText style={styles.rowLabel}>{label}</ThemedText>
        <IconSymbol name="chevron.right" size={18} color={tint} />
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  greeting: { fontSize: 14, opacity: 0.75 },
  menu: { paddingHorizontal: 8, paddingTop: 8, gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 8,
  },
  rowLabel: { flex: 1, fontSize: 16 },
  footer: { padding: 16, marginTop: 'auto' },
  cta: { paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  outline: { backgroundColor: 'transparent', borderWidth: 1 },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
