import { MMKV } from 'react-native-mmkv';
import type { CartStorageItem } from '../types';

/**
 * MMKV-backed guest cart. The web FO stores the same shape in
 * `localStorage` under `kuden-cart-items`; the mobile equivalent uses MMKV
 * for sync access + survives app restarts (docs/_initial/05-data-layer.md).
 *
 * NOTE: this file is intentionally a thin wrapper over MMKV rather than a
 * full `localStorageCollectionOptions` shim. RN does not have `window`, and
 * the TanStack DB browser collection driver references it for `storageEventApi`.
 * A future iteration can wire the full collection driver once we need
 * cross-process sync; for now, a sync MMKV store + React hook is simpler and
 * has the same end-user behavior on a single-process native app.
 */
const STORAGE_ID = 'khanhstore-cart';
const KEY = 'kuden-cart-items'; // MUST match the web FO key for future migration / shared sync.

const mmkv = new MMKV({ id: STORAGE_ID });

export function readCart(): CartStorageItem[] {
  const raw = mmkv.getString(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as CartStorageItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCart(items: CartStorageItem[]): void {
  mmkv.set(KEY, JSON.stringify(items));
}

export function clearCart(): void {
  mmkv.delete(KEY);
}

export const cartStorageKey = KEY;
