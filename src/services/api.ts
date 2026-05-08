/**
 * Centralized API layer.
 *
 * All Supabase interactions flow through this module so that:
 *  1. Error handling is consistent (no duplicated try/catch patterns)
 *  2. Errors are classified (network vs auth vs validation)
 *  3. The service layer is reusable outside React
 */
import { PostgrestError } from '@supabase/supabase-js';

// ─── Error Classification ───────────────────────────────────────────

export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly isRetryable: boolean;

  constructor(message: string, opts: { code?: string; status?: number; isRetryable?: boolean } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = opts.code || 'UNKNOWN';
    this.status = opts.status || 500;
    this.isRetryable = opts.isRetryable ?? false;
  }
}

/**
 * Convert a Supabase PostgrestError into a typed ApiError.
 */
export function handlePostgrestError(error: PostgrestError): never {
  const status = parseInt(error.code, 10) || 500;

  // Auth / permission errors → NOT retryable
  if (error.code === '42501' || error.message?.includes('permission denied')) {
    throw new ApiError('Permission denied — insufficient access rights', {
      code: 'PERMISSION_DENIED',
      status: 403,
      isRetryable: false,
    });
  }

  // Unique constraint violation → NOT retryable
  if (error.code === '23505') {
    throw new ApiError(error.message || 'Duplicate record', {
      code: 'DUPLICATE',
      status: 409,
      isRetryable: false,
    });
  }

  // Foreign key violation → NOT retryable
  if (error.code === '23503') {
    throw new ApiError(error.message || 'Referenced record not found', {
      code: 'FK_VIOLATION',
      status: 422,
      isRetryable: false,
    });
  }

  // Connection / timeout → retryable
  if (
    error.message?.includes('NetworkError') ||
    error.message?.includes('Failed to fetch') ||
    error.message?.includes('TIMEOUT')
  ) {
    throw new ApiError('Network error — please check your connection', {
      code: 'NETWORK_ERROR',
      status: 0,
      isRetryable: true,
    });
  }

  // Default
  throw new ApiError(error.message || 'An unexpected error occurred', {
    code: error.code,
    status,
    isRetryable: status >= 500,
  });
}

/**
 * Unwrap a Supabase response: throw on error, return data.
 *
 * Usage:
 *   const data = unwrap(await supabase.from('x').select('*'));
 */
export function unwrap<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) handlePostgrestError(result.error);
  return result.data as T;
}

/**
 * React Query retry function — only retry on network errors, NOT on 4xx.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (error instanceof ApiError) return error.isRetryable;
  // Never retry version conflicts
  if (error instanceof VersionConflictError) return false;
  // Unknown errors: retry once
  return failureCount < 1;
}

// ─── Version Conflict ───────────────────────────────────────────────

export class VersionConflictError extends Error {
  public readonly serverData: any;
  public readonly clientData: any;
  public readonly serverVersion: number;
  public readonly clientVersion: number;
  public readonly table: string;
  public readonly recordId: string;

  constructor(opts: {
    table: string;
    recordId: string;
    serverVersion: number;
    clientVersion: number;
    serverData: any;
    clientData: any;
  }) {
    super(`Version conflict on ${opts.table}:${opts.recordId} (client v${opts.clientVersion} vs server v${opts.serverVersion})`);
    this.name = 'VersionConflictError';
    this.table = opts.table;
    this.recordId = opts.recordId;
    this.serverVersion = opts.serverVersion;
    this.clientVersion = opts.clientVersion;
    this.serverData = opts.serverData;
    this.clientData = opts.clientData;
  }
}

/**
 * Perform a versioned update: fetch current server record, check version,
 * then apply update only if versions match.
 *
 * Throws VersionConflictError if the server version has changed since
 * the client last read the record.
 */
import { supabase } from '@/integrations/supabase/client';

export async function versionedUpdate(
  table: string,
  recordId: string,
  clientVersion: number,
  updateData: Record<string, any>
): Promise<any> {
  // 1. Fetch current server record
  const { data: serverRecord, error: fetchErr } = await supabase
    .from(table)
    .select('*')
    .eq('id', recordId)
    .single();

  if (fetchErr) handlePostgrestError(fetchErr);

  // 2. Check version
  const serverVersion = serverRecord?.version ?? 1;
  if (serverVersion !== clientVersion) {
    throw new VersionConflictError({
      table,
      recordId,
      serverVersion,
      clientVersion,
      serverData: serverRecord,
      clientData: updateData,
    });
  }

  // 3. Apply update (version will auto-increment via trigger)
  const { data, error } = await supabase
    .from(table)
    .update(updateData)
    .eq('id', recordId)
    .eq('version', clientVersion) // Double-check with WHERE clause
    .select()
    .single();

  if (error) handlePostgrestError(error);

  // 4. If no rows matched (race condition), refetch and throw conflict
  if (!data) {
    const { data: latest } = await supabase.from(table).select('*').eq('id', recordId).single();
    throw new VersionConflictError({
      table,
      recordId,
      serverVersion: latest?.version ?? serverVersion + 1,
      clientVersion,
      serverData: latest,
      clientData: updateData,
    });
  }

  return data;
}
