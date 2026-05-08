/**
 * Realtime Manager — Supabase realtime subscriptions integrated with React Query.
 *
 * Subscribes to Postgres Changes on critical tables and:
 *  • INSERT → invalidates the list query (add to cache)
 *  • UPDATE → patches the cache or invalidates if stale
 *  • DELETE → removes from cache
 *
 * Architecture:
 *   Component calls useRealtimeSync() → subscribes via this manager
 *   Manager receives DB change → updates React Query cache directly
 *   No full refetch unless the change cannot be patched
 */
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

// ─── Types ──────────────────────────────────────────────────────────

type TableName = 'profiles' | 'users_followup' | 'quran_circles' | 'activity_submissions';

interface SubscriptionConfig {
  table: TableName;
  queryKey: readonly unknown[];
  /** If true, only invalidate (refetch) instead of patching cache */
  invalidateOnly?: boolean;
}

type ChangeHandler = (payload: RealtimePostgresChangesPayload<any>) => void;

// ─── Table → Query Key mapping ──────────────────────────────────────

const TABLE_QUERY_MAP: Record<TableName, readonly unknown[]> = {
  profiles: queryKeys.users.all,
  users_followup: queryKeys.followUp.all,
  quran_circles: queryKeys.circles.all,
  activity_submissions: queryKeys.activities.all,
};

// ─── Subscription State ─────────────────────────────────────────────

const activeChannels = new Map<string, RealtimeChannel>();
const changeListeners = new Map<string, Set<ChangeHandler>>();

// ─── Core Functions ─────────────────────────────────────────────────

/**
 * Subscribe to realtime changes on a table.
 * Integrates directly with React Query cache.
 */
export function subscribeToTable(
  queryClient: QueryClient,
  config: SubscriptionConfig
): () => void {
  const channelName = `realtime:${config.table}`;

  // Don't create duplicate subscriptions
  if (activeChannels.has(channelName)) {
    return () => unsubscribeFromTable(config.table);
  }

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: config.table,
      },
      (payload) => {
        handleChange(queryClient, config, payload);
        // Notify any additional listeners
        const listeners = changeListeners.get(config.table);
        if (listeners) {
          listeners.forEach(fn => fn(payload));
        }
      }
    )
    .subscribe((status) => {
      console.log(`[Realtime] ${config.table}: ${status}`);
    });

  activeChannels.set(channelName, channel);

  return () => unsubscribeFromTable(config.table);
}

/**
 * Unsubscribe from a table's realtime changes.
 */
export function unsubscribeFromTable(table: TableName): void {
  const channelName = `realtime:${table}`;
  const channel = activeChannels.get(channelName);
  if (channel) {
    supabase.removeChannel(channel);
    activeChannels.delete(channelName);
  }
}

/**
 * Unsubscribe from all realtime channels.
 */
export function unsubscribeAll(): void {
  activeChannels.forEach((channel) => {
    supabase.removeChannel(channel);
  });
  activeChannels.clear();
}

/**
 * Add a custom listener for changes on a specific table.
 * Useful for conflict detection UI.
 */
export function onTableChange(table: TableName, handler: ChangeHandler): () => void {
  if (!changeListeners.has(table)) {
    changeListeners.set(table, new Set());
  }
  changeListeners.get(table)!.add(handler);
  return () => {
    changeListeners.get(table)?.delete(handler);
  };
}

// ─── Change Handler ─────────────────────────────────────────────────

function handleChange(
  queryClient: QueryClient,
  config: SubscriptionConfig,
  payload: RealtimePostgresChangesPayload<any>
): void {
  const { eventType, new: newRecord, old: oldRecord } = payload;

  console.log(`[Realtime] ${config.table} ${eventType}:`, newRecord?.id || oldRecord?.id);

  switch (eventType) {
    case 'INSERT':
      // New record — invalidate the list to include it
      queryClient.invalidateQueries({ queryKey: config.queryKey });
      break;

    case 'UPDATE':
      if (config.invalidateOnly) {
        queryClient.invalidateQueries({ queryKey: config.queryKey });
      } else {
        // Try to patch the cache directly for detail queries
        patchCacheRecord(queryClient, config, newRecord);
        // Also invalidate list queries to reflect sorted/filtered changes
        queryClient.invalidateQueries({
          queryKey: config.queryKey,
          // Don't refetch if the query is already being viewed
          refetchType: 'none',
        });
        // Mark queries as stale so they refetch on next access
        queryClient.invalidateQueries({ queryKey: config.queryKey });
      }
      break;

    case 'DELETE':
      // Remove from cache and invalidate lists
      queryClient.invalidateQueries({ queryKey: config.queryKey });
      break;
  }
}

/**
 * Patch a single record in the React Query cache without full refetch.
 */
function patchCacheRecord(
  queryClient: QueryClient,
  config: SubscriptionConfig,
  newRecord: any
): void {
  if (!newRecord?.id) return;

  // For tables with detail queries, update the detail cache directly
  const detailKeyMap: Partial<Record<TableName, (id: string) => readonly unknown[]>> = {
    profiles: queryKeys.users.detail,
    quran_circles: queryKeys.circles.detail,
    activity_submissions: queryKeys.activities.list,
  };

  const detailKeyFn = detailKeyMap[config.table];
  if (detailKeyFn) {
    const detailKey = detailKeyFn(newRecord.id);
    queryClient.setQueryData(detailKey, (old: any) => {
      if (!old) return old;
      // Merge new fields into cached record
      return { ...old, ...newRecord };
    });
  }
}

// ─── Convenience: Subscribe to all critical tables ──────────────────

/**
 * Subscribe to all critical tables at once.
 * Returns a cleanup function.
 */
export function subscribeToAllTables(queryClient: QueryClient): () => void {
  const tables: TableName[] = ['profiles', 'users_followup', 'quran_circles', 'activity_submissions'];

  const unsubscribers = tables.map(table =>
    subscribeToTable(queryClient, {
      table,
      queryKey: TABLE_QUERY_MAP[table],
    })
  );

  return () => {
    unsubscribers.forEach(unsub => unsub());
  };
}

/**
 * Check if a table has an active subscription.
 */
export function isSubscribed(table: TableName): boolean {
  return activeChannels.has(`realtime:${table}`);
}
