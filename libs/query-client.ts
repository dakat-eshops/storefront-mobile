import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { MMKV } from 'react-native-mmkv';
import { env } from './env';

/**
 * MMKV-backed persister. MMKV is sync; we wrap with Promise.resolve to
 * satisfy the async storage interface that the persister expects.
 */
const storage = new MMKV({ id: 'khanhstore-query-cache' });

const mmkvStorage = {
  getItem: (key: string) => Promise.resolve(storage.getString(key) ?? null),
  setItem: (key: string, value: string) => {
    storage.set(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    storage.delete(key);
    return Promise.resolve();
  },
};

export const persister = createAsyncStoragePersister({
  storage: mmkvStorage,
  // Bust cache between app versions to avoid stale shape mismatches.
  key: `khanhstore-query-${env.appVersion}`,
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min
      gcTime: 24 * 60 * 60 * 1000, // 24 h
      retry: (failureCount, error: unknown) => {
        // Don't retry 4xx — they're permanent.
        const status = (error as { status?: number } | null)?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      networkMode: 'offlineFirst',
    },
    mutations: {
      networkMode: 'offlineFirst',
      retry: 0,
    },
  },
});
