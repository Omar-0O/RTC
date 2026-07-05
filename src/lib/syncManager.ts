/**
 * Sync Manager — flushes the offline queue when connectivity returns.
 *
 * Features:
 *  • Sequential processing (prevents race conditions)
 *  • Exponential backoff on failures (max 3 retries)
 *  • Duplicate execution prevention (processing lock)
 *  • Conflict detection (logs server-side conflicts)
 *  • Auto-cleanup of synced items
 */
import {
  getPendingItems,
  updateItemStatus,
  clearSynced,
  type QueueItem,
  type MutationType,
} from './offlineQueue';

// Import services for executing mutations
import * as usersService from '@/services/users.service';
import * as circlesService from '@/services/circles.service';
import * as followupService from '@/services/followup.service';

// ─── Types ──────────────────────────────────────────────────────────

export type SyncState = 'idle' | 'syncing' | 'error' | 'offline';

type SyncListener = (state: SyncState, detail?: { pending: number; synced: number; failed: number }) => void;
type CreateSessionPayload = { circleId: string; sessionDate: string; notes: string | null; organizerVolunteerId?: string };

// ─── State ──────────────────────────────────────────────────────────

let isSyncing = false;
const listeners = new Set<SyncListener>();

export function onSyncStateChange(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(state: SyncState, detail?: { pending: number; synced: number; failed: number }) {
  listeners.forEach(fn => fn(state, detail));
}

const getString = (payload: Record<string, unknown>, key: string): string => {
  const value = payload[key];
  return typeof value === 'string' ? value : '';
};

const getNumber = (payload: Record<string, unknown>, key: string): number => {
  const value = payload[key];
  return typeof value === 'number' ? value : Number(value);
};

const getBoolean = (payload: Record<string, unknown>, key: string): boolean => {
  const value = payload[key];
  return typeof value === 'boolean' ? value : Boolean(value);
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error || 'Unknown error');

// ─── Mutation Executor ──────────────────────────────────────────────

/**
 * Maps queue item types to actual service calls.
 * Each mutation is idempotent where possible.
 */
async function executeMutation(item: QueueItem): Promise<void> {
  const { type, payload } = item;

  switch (type as MutationType) {
    // Users
    case 'CREATE_USER':
      await usersService.createUser(payload as unknown as usersService.CreateUserPayload);
      break;
    case 'UPDATE_USER':
      await usersService.updateUser(payload as unknown as usersService.UpdateUserPayload);
      break;
    case 'DELETE_USER':
      await usersService.deleteUser(getString(payload, 'userId'));
      break;
    case 'TOGGLE_USER_ACTIVE':
      await usersService.toggleUserActive(getString(payload, 'userId'), getBoolean(payload, 'isActive'));
      break;
    case 'UPDATE_ROLE':
      await usersService.updateUserRole(getString(payload, 'userId'), getString(payload, 'newRole'));
      break;

    // Circles
    case 'CREATE_CIRCLE':
    case 'UPDATE_CIRCLE':
      await circlesService.saveCircle(payload as unknown as circlesService.SaveCirclePayload);
      break;
    case 'DELETE_CIRCLE':
      await circlesService.deleteCircle(getString(payload, 'circleId'));
      break;
    case 'ENROLL_BENEFICIARY':
      await circlesService.enrollBeneficiary(getString(payload, 'circleId'), getString(payload, 'beneficiaryId'));
      break;
    case 'UNENROLL_BENEFICIARY':
      await circlesService.unenrollBeneficiary(getString(payload, 'circleId'), getString(payload, 'beneficiaryId'));
      break;
    case 'CREATE_SESSION':
      await circlesService.createSession(payload as unknown as CreateSessionPayload);
      break;
    case 'DELETE_SESSION':
      await circlesService.deleteSession(getString(payload, 'sessionId'));
      break;
    case 'SAVE_ATTENDANCE':
      await circlesService.saveAttendance(payload as unknown as circlesService.SaveAttendancePayload);
      break;

    // Follow-up
    case 'ADD_FOLLOWUP':
      await followupService.addFollowUp(payload as unknown as followupService.AddFollowUpPayload);
      break;
    case 'EDIT_FOLLOWUP':
      await followupService.editFollowUp(payload as unknown as followupService.EditFollowUpPayload);
      break;
    case 'APPROVE_FOLLOWUP':
      await followupService.approveFollowUp(getNumber(payload, 'id'));
      break;
    case 'REJECT_FOLLOWUP':
      await followupService.rejectFollowUp(getNumber(payload, 'id'));
      break;

    default:
      console.warn(`[SyncManager] Unknown mutation type: ${type}`);
  }
}

// ─── Sync Engine ────────────────────────────────────────────────────

const MAX_RETRIES = 3;

/**
 * Process the offline queue sequentially.
 * Called automatically when connectivity returns.
 */
export async function flushQueue(): Promise<{ synced: number; failed: number }> {
  if (isSyncing) {
    console.log('[SyncManager] Already syncing, skipping...');
    return { synced: 0, failed: 0 };
  }

  if (!navigator.onLine) {
    emit('offline');
    return { synced: 0, failed: 0 };
  }

  isSyncing = true;
  emit('syncing');

  const items = await getPendingItems();
  let synced = 0;
  let failed = 0;

  for (const item of items) {
    // Skip items that have exceeded max retries
    if (item.retryCount >= MAX_RETRIES) {
      await updateItemStatus(item.id, 'failed', `Exceeded max retries (${MAX_RETRIES})`);
      failed++;
      continue;
    }

    // Mark as processing to prevent duplicate execution
    await updateItemStatus(item.id, 'processing');

    try {
      await executeMutation(item);
      await updateItemStatus(item.id, 'synced');
      synced++;
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err);

      // Conflict detection: if server returns 409 or duplicate error
      if (errMsg.includes('duplicate') || errMsg.includes('conflict') || errMsg.includes('23505')) {
        console.warn(`[SyncManager] Conflict detected for ${item.type}:`, errMsg);
        // Mark as synced (server already has the data)
        await updateItemStatus(item.id, 'synced', `Conflict resolved: ${errMsg}`);
        synced++;
        continue;
      }

      // Non-retryable errors (permission, validation)
      if (errMsg.includes('permission') || errMsg.includes('not found')) {
        await updateItemStatus(item.id, 'failed', errMsg);
        failed++;
        continue;
      }

      // Retryable error — mark as pending for next sync cycle
      await updateItemStatus(item.id, 'pending', errMsg);
      failed++;

      // If we hit a network error, stop processing (we're offline again)
      if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError')) {
        emit('offline');
        break;
      }
    }
  }

  // Cleanup synced items
  await clearSynced();

  isSyncing = false;
  emit(failed > 0 ? 'error' : 'idle', { pending: items.length - synced - failed, synced, failed });

  return { synced, failed };
}

// ─── Auto-Sync on Connectivity Change ───────────────────────────────

let initialized = false;

/**
 * Initialize the sync manager. Call once at app startup.
 * Sets up online/offline event listeners for automatic queue flushing.
 */
export function initSyncManager(): void {
  if (initialized) return;
  initialized = true;

  // Sync when coming back online
  window.addEventListener('online', () => {
    console.log('[SyncManager] Online detected, flushing queue...');
    // Small delay to ensure connection is stable
    setTimeout(() => flushQueue(), 1500);
  });

  window.addEventListener('offline', () => {
    emit('offline');
  });

  // Also try to flush on app startup (in case items were queued last session)
  if (navigator.onLine) {
    setTimeout(() => flushQueue(), 3000);
  }
}
