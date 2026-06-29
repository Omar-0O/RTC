/**
 * Conflict Resolver — handles version conflicts in concurrent editing.
 *
 * Three strategies:
 *  1. Last Write Wins (LWW)    — server version always wins
 *  2. Field-Level Merge        — merge non-conflicting fields automatically
 *  3. Manual Resolution        — return both versions for user to decide
 */

// ─── Types ──────────────────────────────────────────────────────────

export type ConflictStrategy = 'last-write-wins' | 'field-merge' | 'manual';

export type ConflictRecord = Record<string, unknown>;

export interface ConflictInfo<T = ConflictRecord> {
  type: 'CONFLICT';
  table: string;
  recordId: string;
  clientVersion: number;
  serverVersion: number;
  clientData: T;
  serverData: T;
  /** Fields that differ between client and server */
  conflictingFields: string[];
  /** Fields only client changed (safe to keep) */
  clientOnlyFields: string[];
  /** Fields only server changed (safe to keep) */
  serverOnlyFields: string[];
}

export interface MergeResult<T = ConflictRecord> {
  resolved: boolean;
  strategy: ConflictStrategy;
  mergedData: T;
  /** Fields that couldn't be auto-merged (need manual resolution) */
  unresolvedFields: string[];
}

// ─── Detection ──────────────────────────────────────────────────────

/**
 * Detect if there's a version conflict.
 * Call this BEFORE sending an update to the server.
 */
export function detectConflict<T extends ConflictRecord>(
  table: string,
  recordId: string,
  clientVersion: number,
  serverVersion: number,
  clientData: T,
  serverData: T,
  /** Fields to ignore when comparing (e.g., updated_at, version) */
  ignoreFields: string[] = ['version', 'updated_at', 'updated_by', 'created_at']
): ConflictInfo<T> | null {
  // No conflict if versions match
  if (clientVersion >= serverVersion) return null;

  // Compare fields to find actual differences
  const allKeys = new Set([...Object.keys(clientData), ...Object.keys(serverData)]);
  const conflictingFields: string[] = [];
  const clientOnlyFields: string[] = [];
  const serverOnlyFields: string[] = [];

  for (const key of allKeys) {
    if (ignoreFields.includes(key)) continue;

    const clientVal = JSON.stringify(clientData[key]);
    const serverVal = JSON.stringify(serverData[key]);

    // If client changed this field (differs from original)
    // and server also changed it — conflict
    if (clientVal !== serverVal) {
      // We don't have the "original" here, so any diff is a potential conflict
      conflictingFields.push(key);
    }
  }

  // If no actual field differences, no real conflict
  if (conflictingFields.length === 0) return null;

  return {
    type: 'CONFLICT',
    table,
    recordId,
    clientVersion,
    serverVersion,
    clientData,
    serverData,
    conflictingFields,
    clientOnlyFields,
    serverOnlyFields,
  };
}

// ─── Resolution Strategies ──────────────────────────────────────────

/**
 * Strategy 1: Last Write Wins — server version always wins.
 * Simplest strategy, no data loss detection.
 */
export function resolveLastWriteWins<T extends ConflictRecord>(
  conflict: ConflictInfo<T>
): MergeResult<T> {
  return {
    resolved: true,
    strategy: 'last-write-wins',
    mergedData: { ...conflict.serverData },
    unresolvedFields: [],
  };
}

/**
 * Strategy 2: Field-Level Merge — auto-merge non-conflicting fields.
 * If both client and server changed the same field → mark unresolved.
 */
export function resolveFieldMerge<T extends ConflictRecord>(
  conflict: ConflictInfo<T>,
  /** The original data (before either client or server modified it) */
  originalData?: T
): MergeResult<T> {
  const merged: ConflictRecord = { ...conflict.serverData };
  const unresolvedFields: string[] = [];

  for (const field of conflict.conflictingFields) {
    if (originalData) {
      const originalVal = JSON.stringify(originalData[field]);
      const clientVal = JSON.stringify(conflict.clientData[field]);
      const serverVal = JSON.stringify(conflict.serverData[field]);

      // Only client changed → keep client
      if (clientVal !== originalVal && serverVal === originalVal) {
        merged[field] = conflict.clientData[field];
        continue;
      }
      // Only server changed → keep server (already in merged)
      if (serverVal !== originalVal && clientVal === originalVal) {
        continue;
      }
      // Both changed → unresolved
      unresolvedFields.push(field);
    } else {
      // No original data available — can't determine who changed what
      // Default to server for safety, mark as unresolved
      unresolvedFields.push(field);
    }
  }

  return {
    resolved: unresolvedFields.length === 0,
    strategy: 'field-merge',
    mergedData: merged as T,
    unresolvedFields,
  };
}

/**
 * Strategy 3: Manual Resolution — return both versions for user to pick.
 * The UI component (ConflictDialog) handles the actual resolution.
 */
export function resolveManual<T extends ConflictRecord>(
  conflict: ConflictInfo<T>
): MergeResult<T> {
  return {
    resolved: false,
    strategy: 'manual',
    mergedData: conflict.serverData,
    unresolvedFields: conflict.conflictingFields,
  };
}

/**
 * Apply a user's manual resolution choices.
 */
export function applyManualResolution<T extends ConflictRecord>(
  conflict: ConflictInfo<T>,
  /** Map of field → 'client' | 'server' choices made by user */
  choices: Record<string, 'client' | 'server'>
): T {
  const merged: ConflictRecord = { ...conflict.serverData };

  for (const [field, choice] of Object.entries(choices)) {
    if (choice === 'client') {
      merged[field] = conflict.clientData[field];
    }
    // 'server' → already in merged
  }

  return merged as T;
}

// ─── Convenience ────────────────────────────────────────────────────

/**
 * Auto-resolve a conflict using the specified strategy.
 */
export function autoResolve<T extends ConflictRecord>(
  conflict: ConflictInfo<T>,
  strategy: ConflictStrategy = 'last-write-wins',
  originalData?: T
): MergeResult<T> {
  switch (strategy) {
    case 'last-write-wins':
      return resolveLastWriteWins(conflict);
    case 'field-merge':
      return resolveFieldMerge(conflict, originalData);
    case 'manual':
      return resolveManual(conflict);
  }
}
