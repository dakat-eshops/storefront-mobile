import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Supabase client for Realtime ONLY.
 *
 * - `auth.persistSession: false` — Clerk owns auth; we never use Supabase auth on mobile.
 * - `realtime.params.eventsPerSecond: 10` — throttle inbound Broadcast events.
 *
 * See docs/_initial/06-realtime.md.
 */
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});
