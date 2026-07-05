/**
 * useRealtimeSync — React hook for real-time data synchronization.
 *
 * Connects components to Supabase realtime channels and auto-updates
 * React Query cache when remote changes arrive.
 *
 * Usage:
 *   // Subscribe to all tables (in App or layout):
 *   useRealtimeSync();
 *
 *   // Subscribe to specific table with conflict handler:
 *   useRealtimeSync({
 *     tables: ['profiles'],
 *     onConflict: (info) => setConflictDialog(info),
 *   });
 */
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeToAllTables, subscribeToTable, onTableChange } from '@/lib/realtime';
import { detectConflict, type ConflictInfo, type ConflictRecord } from '@/lib/conflictResolver';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { queryKeys } from '@/lib/queryKeys';

// ─── Types ──────────────────────────────────────────────────────────

type TableName = 'profiles' | 'users_followup' | 'quran_circles' | 'activity_submissions';

interface UseRealtimeSyncOptions {
  /** Which tables to subscribe to. Defaults to all critical tables. */
  tables?: TableName[];
  /** Called when an UPDATE might conflict with local edits. */
  onConflict?: (conflict: ConflictInfo) => void;
  /** Whether the subscription is active. Defaults to true. */
  enabled?: boolean;
}

const TABLE_QUERY_MAP: Record<TableName, readonly unknown[]> = {
  profiles: queryKeys.users.all,
  users_followup: queryKeys.followUp.all,
  quran_circles: queryKeys.circles.all,
  activity_submissions: queryKeys.activities.all,
};

const DEFAULT_TABLES: TableName[] = ['profiles', 'users_followup', 'quran_circles', 'activity_submissions'];

type EditableRecord = ConflictRecord & {
  id: string;
  version?: number;
};

// ─── Hook ───────────────────────────────────────────────────────────

export function useRealtimeSync(options?: UseRealtimeSyncOptions) {
  const queryClient = useQueryClient();
  const { tables, onConflict, enabled = true } = options ?? {};
  const tableKey = tables?.join(',') ?? '';
  const hasTableFilter = tableKey.length > 0;
  const selectedTables = useMemo<TableName[]>(
    () => (hasTableFilter ? (tableKey.split(',') as TableName[]) : DEFAULT_TABLES),
    [hasTableFilter, tableKey]
  );
  const [lastEvent, setLastEvent] = useState<{
    table: string;
    event: string;
    recordId: string;
    timestamp: number;
  } | null>(null);

  // Track which records the user is currently editing (for conflict detection)
  const editingRecordsRef = useRef<Map<string, { version: number; data: ConflictRecord }>>(new Map());

  // ─── Start/stop subscriptions ───────────────────────────────────
  useEffect(() => {
    if (!enabled) return;

    let cleanup: (() => void) | undefined;

    if (!hasTableFilter) {
      // Subscribe to all tables
      cleanup = subscribeToAllTables(queryClient);
    } else {
      // Subscribe to specific tables
      const unsubs = selectedTables.map(table =>
        subscribeToTable(queryClient, {
          table,
          queryKey: TABLE_QUERY_MAP[table],
        })
      );
      cleanup = () => unsubs.forEach(fn => fn());
    }

    return cleanup;
  }, [queryClient, enabled, hasTableFilter, selectedTables]);

  // ─── Conflict detection listener ────────────────────────────────
  useEffect(() => {
    if (!enabled || !onConflict) return;

    const unsubs = selectedTables.map(table =>
      onTableChange(table, (payload: RealtimePostgresChangesPayload<EditableRecord>) => {
        if (payload.eventType !== 'UPDATE') return;

        const newRecord = payload.new;
        if (!newRecord?.id) return;

        // Track event for UI
        setLastEvent({
          table,
          event: 'UPDATE',
          recordId: newRecord.id,
          timestamp: Date.now(),
        });

        // Check if this record is being edited locally
        const editKey = `${table}:${newRecord.id}`;
        const localEdit = editingRecordsRef.current.get(editKey);
        if (!localEdit) return;

        // Detect conflict
        const conflict = detectConflict(
          table,
          newRecord.id,
          localEdit.version,
          newRecord.version ?? 0,
          localEdit.data,
          newRecord
        );

        if (conflict) {
          console.warn(`[Realtime] Conflict detected on ${table}:${newRecord.id}`);
          onConflict(conflict);
        }
      })
    );

    return () => unsubs.forEach(fn => fn());
  }, [enabled, onConflict, selectedTables]);

  // ─── API for marking records as "being edited" ─────────────────
  const markEditing = useCallback((table: TableName, recordId: string, version: number, data: ConflictRecord) => {
    editingRecordsRef.current.set(`${table}:${recordId}`, { version, data });
  }, []);

  const clearEditing = useCallback((table: TableName, recordId: string) => {
    editingRecordsRef.current.delete(`${table}:${recordId}`);
  }, []);

  return {
    lastEvent,
    markEditing,
    clearEditing,
  };
}
