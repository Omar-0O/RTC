/**
 * Offline Queue — IndexedDB-backed mutation queue for offline-first operations.
 *
 * When the user performs mutations while offline:
 *  1. The mutation is stored in IndexedDB with status "pending"
 *  2. When connectivity returns, the queue is flushed sequentially
 *  3. Successful items are marked "synced"; failures are retried with backoff
 *
 * Uses the raw IndexedDB API (no library dependency).
 */

// ─── Types ──────────────────────────────────────────────────────────

export type MutationType =
  | 'CREATE_USER' | 'UPDATE_USER' | 'DELETE_USER' | 'TOGGLE_USER_ACTIVE' | 'UPDATE_ROLE'
  | 'CREATE_CIRCLE' | 'UPDATE_CIRCLE' | 'DELETE_CIRCLE'
  | 'ENROLL_BENEFICIARY' | 'UNENROLL_BENEFICIARY'
  | 'CREATE_SESSION' | 'DELETE_SESSION' | 'SAVE_ATTENDANCE'
  | 'ADD_FOLLOWUP' | 'EDIT_FOLLOWUP' | 'APPROVE_FOLLOWUP' | 'REJECT_FOLLOWUP';

export type QueueItemStatus = 'pending' | 'processing' | 'synced' | 'failed';

export interface QueueItem {
  id: string;
  type: MutationType;
  payload: any;
  timestamp: number;
  status: QueueItemStatus;
  retryCount: number;
  error?: string;
}

// ─── IndexedDB Helpers ──────────────────────────────────────────────

const DB_NAME = 'rtc_offline_queue';
const DB_VERSION = 1;
const STORE_NAME = 'mutations';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Queue Operations ───────────────────────────────────────────────

/**
 * Add a mutation to the offline queue.
 * Returns the queue item ID for tracking.
 */
export async function enqueue(type: MutationType, payload: any): Promise<string> {
  const db = await openDB();
  const id = generateId();
  const item: QueueItem = {
    id,
    type,
    payload,
    timestamp: Date.now(),
    status: 'pending',
    retryCount: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add(item);
    tx.oncomplete = () => { db.close(); resolve(id); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/**
 * Get all pending items, ordered by timestamp (FIFO).
 */
export async function getPendingItems(): Promise<QueueItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('status');
    const pending = index.getAll('pending');
    const processing = index.getAll('processing');

    tx.oncomplete = () => {
      const items = [...(pending.result || []), ...(processing.result || [])];
      items.sort((a, b) => a.timestamp - b.timestamp);
      db.close();
      resolve(items);
    };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/**
 * Update the status of a queue item.
 */
export async function updateItemStatus(
  id: string,
  status: QueueItemStatus,
  error?: string
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const item = getReq.result as QueueItem | undefined;
      if (item) {
        item.status = status;
        if (error) item.error = error;
        if (status === 'failed') item.retryCount++;
        store.put(item);
      }
    };

    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/**
 * Remove all synced items from the queue (cleanup).
 */
export async function clearSynced(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('status');
    const req = index.openCursor('synced');

    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/**
 * Get the count of pending items (for UI badges).
 */
export async function getPendingCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('status');
    const req = index.count('pending');

    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

/**
 * Get all items (for debugging / admin UI).
 */
export async function getAllItems(): Promise<QueueItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    tx.oncomplete = () => { db.close(); resolve(req.result || []); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
