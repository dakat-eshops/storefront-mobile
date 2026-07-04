import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Connection-budget gate: `true` while the app is in the foreground (or has
 * left it for less than the grace period), `false` once backgrounded past it.
 *
 * Supabase Realtime bills on PEAK CONCURRENT connections — a backgrounded app
 * holding a WebSocket costs the same as an active shopper. Every Broadcast
 * subscription hook composes this gate into its subscribe condition so the
 * channel is explicitly torn down shortly after backgrounding and rejoined on
 * foreground (see BO BROADCAST_FANOUT_GUIDE "Connection budget"). The OS would
 * eventually kill the socket anyway (~30s on iOS); tearing down ourselves is
 * deterministic and drops the server-side connection immediately.
 *
 * The grace period absorbs `inactive` flickers (control centre, permission
 * dialogs, app switcher peeks) without churning the socket. It is kept short
 * so the teardown timer still runs inside the ~5s of background execution iOS
 * grants before suspending JS; if the timer is frozen anyway, it fires on
 * resume and the effect immediately rejoins — wasteful once, never wrong.
 */

/** Away from foreground longer than this → subscriptions are torn down. */
export const APP_ACTIVE_GRACE_MS = 3_000;

export function useAppActiveGate(
  graceMs: number = APP_ACTIVE_GRACE_MS,
): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (timer !== undefined) {
          clearTimeout(timer);
          timer = undefined;
        }
        setActive(true);
      } else if (timer === undefined) {
        // 'inactive' or 'background' — start (or keep) the countdown.
        timer = setTimeout(() => {
          timer = undefined;
          setActive(false);
        }, graceMs);
      }
    });

    return () => {
      sub.remove();
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [graceMs]);

  return active;
}
