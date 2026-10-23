import { useSyncExternalStore } from 'react';

export type SyncPhase = 'idle' | 'syncing' | 'error' | 'offline';

export interface SyncStatus {
  phase: SyncPhase;
  online: boolean;
  lastSyncedAt: string | null;
  error: string | null;
}

let state: SyncStatus = {
  phase: 'idle',
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  lastSyncedAt: null,
  error: null,
};
const listeners = new Set<() => void>();

export function setSyncStatus(patch: Partial<SyncStatus>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export function getSyncStatus(): SyncStatus {
  return state;
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}
