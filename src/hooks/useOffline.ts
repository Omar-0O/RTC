/**
 * React hooks for offline/sync status.
 *
 * useOfflineStatus()  — returns current network state
 * useSyncStatus()     — returns sync engine state + pending count
 * useOfflineMutation() — wraps mutations with offline queue fallback
 */
import { useState, useEffect, useCallback } from 'react';
import { onSyncStateChange, flushQueue, type SyncState } from '@/lib/syncManager';
import { enqueue, getPendingCount, type MutationType } from '@/lib/offlineQueue';

// ─── useOfflineStatus ───────────────────────────────────────────────

export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, isOffline: !isOnline };
}

// ─── useSyncStatus ──────────────────────────────────────────────────

interface SyncStatusInfo {
  state: SyncState;
  pendingCount: number;
  lastSyncResult?: { synced: number; failed: number };
}

export function useSyncStatus(): SyncStatusInfo {
  const [state, setState] = useState<SyncState>('idle');
  const [pendingCount, setPendingCount] = useState(0);
  const [lastResult, setLastResult] = useState<{ synced: number; failed: number }>();

  useEffect(() => {
    // Poll pending count on mount
    getPendingCount().then(setPendingCount).catch(() => {});

    const unsubscribe = onSyncStateChange((newState, detail) => {
      setState(newState);
      if (detail) {
        setPendingCount(detail.pending);
        setLastResult({ synced: detail.synced, failed: detail.failed });
      }
    });

    // Refresh pending count periodically
    const interval = setInterval(() => {
      getPendingCount().then(setPendingCount).catch(() => {});
    }, 10000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return { state, pendingCount, lastSyncResult: lastResult };
}

// ─── useOfflineMutation ─────────────────────────────────────────────

/**
 * Wraps a mutation to support offline queueing.
 *
 * If online: executes immediately.
 * If offline: enqueues to IndexedDB and applies optimistic UI update.
 *
 * Usage:
 *   const { mutate } = useOfflineMutation('CREATE_USER', createUserFn);
 *   mutate(payload); // works online or offline
 */
export function useOfflineMutation<TPayload>(
  type: MutationType,
  onlineFn: (payload: TPayload) => Promise<any>,
  options?: {
    onOptimisticUpdate?: (payload: TPayload) => void;
    onRollback?: (payload: TPayload) => void;
    onSuccess?: (result: any) => void;
    onError?: (error: Error) => void;
  }
) {
  const { isOnline } = useOfflineStatus();
  const [isLoading, setIsLoading] = useState(false);

  const mutate = useCallback(async (payload: TPayload) => {
    // Apply optimistic update immediately
    options?.onOptimisticUpdate?.(payload);

    if (isOnline) {
      // Online: execute directly
      setIsLoading(true);
      try {
        const result = await onlineFn(payload);
        options?.onSuccess?.(result);
        return result;
      } catch (err: any) {
        // If it's a network error, queue it instead
        if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
          console.log('[OfflineMutation] Network error, queueing...');
          await enqueue(type, payload);
          return;
        }
        options?.onRollback?.(payload);
        options?.onError?.(err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    } else {
      // Offline: queue for later sync
      console.log(`[OfflineMutation] Offline, queueing ${type}...`);
      await enqueue(type, payload);
    }
  }, [isOnline, type, onlineFn, options]);

  return { mutate, isLoading };
}

// ─── useManualSync ──────────────────────────────────────────────────

/**
 * Hook to manually trigger queue flush (e.g., from a "Sync now" button).
 */
export function useManualSync() {
  const [isSyncing, setIsSyncing] = useState(false);

  const sync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const result = await flushQueue();
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return { sync, isSyncing };
}
