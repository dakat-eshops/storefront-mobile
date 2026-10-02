// react-native-mmkv v4: instances come from `createMMKV()` (`MMKV` is only a
// type in v4, so constructing it threw at runtime) and `.delete` is `.remove`.
import { createMMKV } from 'react-native-mmkv';
import type { WishlistItem } from '../types';

/**
 * MMKV-backed wishlist. Same shape rationale as `features/cart/collections/storage.ts`.
 * Key matches the web FO storage key so a future shared sync can land cleanly.
 */
const STORAGE_ID = 'khanhstore-wishlist';
const KEY = 'storefront-wishlist-items';

const mmkv = createMMKV({ id: STORAGE_ID });

export function readWishlist(): WishlistItem[] {
  const raw = mmkv.getString(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as WishlistItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeWishlist(items: WishlistItem[]): void {
  mmkv.set(KEY, JSON.stringify(items));
}

export function clearWishlist(): void {
  mmkv.remove(KEY);
}
