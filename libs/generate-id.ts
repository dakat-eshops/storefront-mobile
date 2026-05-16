import * as Crypto from 'expo-crypto';

/** Client-generated UUID for idempotency keys. Uses expo-crypto (already installed). */
export function generateId(): string {
  return Crypto.randomUUID();
}
