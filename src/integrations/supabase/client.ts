import { createClient, type Session } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];

export const AUTH_STORAGE_KEY = `sb-${projectRef}-auth-token`;
export const AUTH_RELOGIN_NOTICE_KEY = 'rtc-auth-relogin-required';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type PersistedSessionEnvelope = Partial<Session> & {
  session?: Partial<Session> | null;
};

const extractErrorMessage = (error: unknown): string => {
  if (!error) return '';
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return String(error);
};

const extractErrorStatus = (error: unknown): number | undefined => {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number') return status;
  }
  return undefined;
};

const extractErrorName = (error: unknown): string => {
  if (typeof error === 'object' && error !== null && 'name' in error) {
    const name = (error as { name?: unknown }).name;
    if (typeof name === 'string') return name;
  }
  return '';
};

/**
 * Identifies transient network failures, offline states, or HTTP 429/5xx rate-limit
 * responses. These must NEVER purge a user's stored refresh_token from localStorage.
 */
export const isRateLimitOrTransientAuthError = (error: unknown): boolean => {
  if (!error) return false;
  const status = extractErrorStatus(error);
  const name = extractErrorName(error);
  const message = extractErrorMessage(error);

  if (status === 429 || (typeof status === 'number' && status >= 500 && status < 600)) {
    return true;
  }

  if (name === 'AuthRetryableFetchError' || name === 'AbortError') {
    return true;
  }

  return /too many requests|rate limit|429|failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|timed out|aborted|offline/i.test(
    message
  );
};

/**
 * Identifies genuinely revoked, consumed, or non-existent refresh tokens
 * where the server permanently rejected the refresh credential.
 */
export const isRevokedTokenError = (error: unknown): boolean => {
  if (!error || isRateLimitOrTransientAuthError(error)) {
    return false;
  }

  const message = extractErrorMessage(error);
  return /invalid refresh token|refresh token not found|refresh token revoked|refresh token reuse|invalid_grant|already used/i.test(
    message
  );
};

const getLegacyCookie = (key: string) => {
  const encodedKey = `${encodeURIComponent(key)}=`;
  const cookie = document.cookie.split('; ').find((entry) => entry.startsWith(encodedKey));

  if (!cookie) return null;

  try {
    return decodeURIComponent(cookie.slice(encodedKey.length));
  } catch {
    return null;
  }
};

const removeLegacyCookie = (key: string) => {
  document.cookie = `${encodeURIComponent(key)}=; Max-Age=0; Path=/; SameSite=Lax`;
};

export const clearLegacyAuthStorage = () => {
  try {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem('rememberMe');
    removeLegacyCookie(AUTH_STORAGE_KEY);
  } catch {
    // Clearing a legacy copy is best effort when browser storage is unavailable.
  }
};

const resolveDefaultStorage = (): StorageLike | null => {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage && typeof globalThis.localStorage.getItem === 'function') {
      return globalThis.localStorage;
    }
  } catch {
    // Storage access denied or unavailable
  }
  return null;
};

// ── Clock-Skew-Proof Storage Adapter ─────────────────────────────────────────
// Anchors `expires_at` to `local_now + expires_in` ONLY when a NEW `access_token`
// is first persisted (or when `expires_at` is missing). When the same `access_token`
// is re-saved (e.g., user metadata updates or hydration write-backs), its existing
// `expires_at` is preserved so an aging token is never falsely extended by 3600s.
export const createClockSkewCorrectedStorage = (backingStorage?: StorageLike): StorageLike => {
  const getBacking = (): StorageLike | null => backingStorage ?? resolveDefaultStorage();

  return {
    getItem: (key: string): string | null => {
      const storage = getBacking();
      if (!storage) return null;

      let raw: string | null;
      try {
        raw = storage.getItem(key);
      } catch {
        return null;
      }
      if (!raw) return null;

      try {
        const parsed = JSON.parse(raw) as PersistedSessionEnvelope;
        if (parsed && typeof parsed === 'object') {
          const refreshToken = parsed.refresh_token ?? parsed.session?.refresh_token;
          const expiresIn = parsed.expires_in ?? parsed.session?.expires_in ?? 3600;
          const nowSec = Math.floor(Date.now() / 1000);
          const currentExpiresAt = parsed.expires_at ?? parsed.session?.expires_at;

          // Only supply an anchor when expires_at is completely missing from storage
          const isMissingExpiry = !currentExpiresAt && !!refreshToken;

          if (isMissingExpiry) {
            const safeExpiresAt = nowSec + expiresIn;
            if ('expires_at' in parsed || parsed.access_token) parsed.expires_at = safeExpiresAt;
            if (parsed.session && typeof parsed.session === 'object') {
              parsed.session.expires_at = safeExpiresAt;
            }

            const updatedRaw = JSON.stringify(parsed);
            storage.setItem(key, updatedRaw);
            return updatedRaw;
          }
        }
        return raw;
      } catch {
        return raw;
      }
    },
    setItem: (key: string, value: string): void => {
      const storage = getBacking();
      if (!storage) return;

      try {
        const parsed = JSON.parse(value) as PersistedSessionEnvelope;
        if (parsed && typeof parsed === 'object') {
          const incomingAccessToken = parsed.access_token ?? parsed.session?.access_token;

          let existingAccessToken: string | undefined;
          let existingExpiresAt: number | undefined;

          const existingRaw = storage.getItem(key);
          if (existingRaw) {
            try {
              const existingParsed = JSON.parse(existingRaw) as PersistedSessionEnvelope;
              if (existingParsed && typeof existingParsed === 'object') {
                existingAccessToken = existingParsed.access_token ?? existingParsed.session?.access_token;
                existingExpiresAt = existingParsed.expires_at ?? existingParsed.session?.expires_at;
              }
            } catch {
              // Ignore malformed existing JSON
            }
          }

          const isSameAccessToken =
            Boolean(incomingAccessToken) &&
            incomingAccessToken === existingAccessToken &&
            typeof existingExpiresAt === 'number' &&
            existingExpiresAt > 0;

          const expiresIn = parsed.expires_in ?? parsed.session?.expires_in ?? 3600;
          const nowSec = Math.floor(Date.now() / 1000);
          const targetExpiresAt = isSameAccessToken ? existingExpiresAt! : nowSec + expiresIn;

          if (parsed.access_token || 'expires_at' in parsed) {
            parsed.expires_at = targetExpiresAt;
          }
          if (parsed.session && typeof parsed.session === 'object') {
            parsed.session.expires_at = targetExpiresAt;
          }

          storage.setItem(key, JSON.stringify(parsed));
          return;
        }
      } catch {
        // Fallback below
      }
      try {
        storage.setItem(key, value);
      } catch {
        // Best-effort when storage quota or access is unavailable
      }
    },
    removeItem: (key: string): void => {
      try {
        getBacking()?.removeItem(key);
      } catch {
        // Best-effort
      }
    },
  };
};

export const clockSkewCorrectedStorage = createClockSkewCorrectedStorage();

const migrateLegacyAuthStorage = () => {
  try {
    const persistedSession = localStorage.getItem(AUTH_STORAGE_KEY);
    const legacySession = sessionStorage.getItem(AUTH_STORAGE_KEY) ?? getLegacyCookie(AUTH_STORAGE_KEY);

    if (!persistedSession && legacySession) {
      localStorage.setItem(AUTH_STORAGE_KEY, legacySession);
    }
  } catch {
    // Supabase uses in-memory storage when browser storage is unavailable.
  } finally {
    clearLegacyAuthStorage();
  }
};

// One-time migration from the former custom adapter. Standard localStorage keeps
// Supabase refresh tokens synchronized across browser tabs.
migrateLegacyAuthStorage();

/**
 * Safely reads the persisted session snapshot from storage if it contains a
 * refresh_token and user object. Used to preserve the user's session across
 * transient offline / network hiccups while waiting for background token refresh.
 */
export const getStoredSessionSnapshot = (
  storage: StorageLike = localStorage,
  storageKey: string = AUTH_STORAGE_KEY
): Session | null => {
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PersistedSessionEnvelope;
    if (!parsed || typeof parsed !== 'object') return null;

    const candidate = (parsed.session && typeof parsed.session === 'object' ? parsed.session : parsed) as Partial<Session>;
    if (
      typeof candidate.access_token === 'string' &&
      typeof candidate.refresh_token === 'string' &&
      candidate.refresh_token.length > 0 &&
      candidate.user &&
      typeof candidate.user.id === 'string'
    ) {
      return candidate as Session;
    }
  } catch {
    // Ignore storage read or parse errors
  }
  return null;
};

export const markReauthenticationRequired = () => {
  try {
    sessionStorage.setItem(AUTH_RELOGIN_NOTICE_KEY, '1');
  } catch {
    // The login screen remains usable when sessionStorage is unavailable.
  }
};

export interface PurgeSessionOptions {
  /** If provided, do not purge if storage now holds a different (already-rotated) refresh token. */
  failedRefreshToken?: string;
  /** Bypass multi-tab/freshness guards and force removal. */
  force?: boolean;
  storage?: StorageLike;
  storageKey?: string;
}

/**
 * Multi-tab-safe session purge. Refuses to delete storage if another tab has
 * already rotated the refresh_token or written a fresh, non-expired access_token.
 */
export const purgeSessionAndMarkReauth = (options: PurgeSessionOptions = {}): boolean => {
  const {
    failedRefreshToken,
    force = false,
    storage = localStorage,
    storageKey = AUTH_STORAGE_KEY,
  } = options;

  try {
    if (!force) {
      const currentSnapshot = getStoredSessionSnapshot(storage, storageKey);
      if (currentSnapshot) {
        if (failedRefreshToken && currentSnapshot.refresh_token !== failedRefreshToken) {
          // Another tab already rotated the token and saved a new session.
          return false;
        }
        const nowMs = Date.now();
        if (
          !failedRefreshToken &&
          typeof currentSnapshot.expires_at === 'number' &&
          currentSnapshot.expires_at * 1000 > nowMs + 30_000
        ) {
          // Current stored access_token is still valid; do not wipe it.
          return false;
        }
      }
    }

    storage.removeItem(storageKey);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // Best-effort
    }
    clearLegacyAuthStorage();
    markReauthenticationRequired();
    return true;
  } catch {
    return false;
  }
};

export const purgeExpiredAuthToken = () => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return false;

    const parsed = JSON.parse(raw) as PersistedSessionEnvelope;
    const refreshToken: string | undefined =
      parsed?.refresh_token ?? parsed?.session?.refresh_token;

    // Only purge if refresh token is missing. A valid refresh_token can always renew an expired access_token.
    if (!refreshToken) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      console.info('[Auth] Purged auth token from storage due to missing refresh_token.');
      return true;
    }
  } catch {
    // Best-effort
  }
  return false;
};

purgeExpiredAuthToken();

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: clockSkewCorrectedStorage,
    storageKey: AUTH_STORAGE_KEY,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export const kioskSupabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: sessionStorage,
    storageKey: 'rtc-kiosk-auth-token',
    persistSession: false,
    autoRefreshToken: false,
  },
});
