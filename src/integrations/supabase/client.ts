import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];

export const AUTH_STORAGE_KEY = `sb-${projectRef}-auth-token`;
export const AUTH_RELOGIN_NOTICE_KEY = 'rtc-auth-relogin-required';

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

// ── Early stale token guard ──────────────────────────────────────────────────
// If the stored access_token is expired, purge it immediately before the
// Supabase client is created so the SDK does NOT attempt to auto-refresh
// (which causes 429 rate-limit loops when refresh_token is also invalid).
export const purgeExpiredAuthToken = () => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return false;

    const parsed = JSON.parse(raw);
    // Supabase stores expires_at as a Unix timestamp (seconds since epoch)
    const expiresAt: number | undefined =
      parsed?.expires_at ?? parsed?.session?.expires_at;

    // Also check that a refresh_token exists - without it the SDK will 429.
    const refreshToken: string | undefined =
      parsed?.refresh_token ?? parsed?.session?.refresh_token;

    const isExpired = expiresAt && Date.now() / 1000 > expiresAt;
    const isMissingRefresh = !refreshToken;

    if (isExpired || isMissingRefresh) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      console.info('[Auth] Purged stale auth token from storage to prevent 429 refresh loop.',
        { isExpired, isMissingRefresh });
      return true;
    }
  } catch {
    // Best-effort: if we can't read/parse the token, leave it alone.
  }
  return false;
};

purgeExpiredAuthToken();

export const markReauthenticationRequired = () => {
  try {
    sessionStorage.setItem(AUTH_RELOGIN_NOTICE_KEY, '1');
  } catch {
    // The login screen remains usable when sessionStorage is unavailable.
  }
};

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    storageKey: AUTH_STORAGE_KEY,
    persistSession: true,
    autoRefreshToken: true,
    // Prevent the SDK from reading a session from URL hash/params on every
    // page load, which can trigger extra getSession → refresh_token calls.
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
