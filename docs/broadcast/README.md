# Broadcast Subscribers — Mobile FO

Supabase Realtime Broadcast subscriber patterns for the mobile storefront.

## Documents

| File | Topic |
| --- | --- |
| [01-subscriber-playbook.md](01-subscriber-playbook.md) | Subscriber hook pattern, `AppState` reconnect, `setQueryData` patch pattern |
| [02-channel-reference.md](02-channel-reference.md) | 4 channels × events table, payload schemas |

## Key invariants

1. **Broadcast is additive.** `'use cache'` / initial API fetch provides the first-paint data. Broadcast patches it in-place. Never replace the entire list on a broadcast message.
2. **ElectricSQL is NOT used on mobile.** HTTP/1.1 6-connection limit and HMAC-signed URL binary extraction problem make it unsuitable. Broadcast is the realtime layer.
3. **`AppState.addEventListener` gates reconnect.** When the app goes to foreground after a background gap, reconnect the Supabase channel and do a full query invalidation (Broadcast events sent during background are lost).
4. **`setQueryData` for surgical patches.** Only update the fields that changed (inventory quantity / price) — never replace the full product object.
5. **Payload contract is stable.** `libs/realtime/payloads.ts` mirrors BO `BROADCAST_FANOUT_GUIDE.md §5`. Changes require a coordinated PR in both BO and mobile repos.

## Cross-references

- BO Broadcast guide: [BO/e-Shops/docs/features/supabase/realtime/BROADCAST_FANOUT_GUIDE.md](../../../../BO/e-Shops/docs/features/supabase/realtime/BROADCAST_FANOUT_GUIDE.md)
- FO web realtime: [FO/KhanhStore/src/libs/realtime/](../../../../FO/KhanhStore/src/libs/realtime/)
- `libs/supabase.ts`: Supabase client with `auth: { persistSession: false }`
