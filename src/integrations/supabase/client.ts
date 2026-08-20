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

// ── Clock-Skew-Proof Storage Adapter ─────────────────────────────────────────
// When Supabase SDK receives a session from the auth server, the server's `expires_at`
// is calculated using the server's clock. If the user's PC clock is skewed ahead
// (common on dual-boot Linux/Windows or unsynced PC clocks), local Date.now() > expires_at.
// The SDK compares local time with server expires_at, wrongly concludes the access_token
// is EXPIRED, and launches a refresh_token request for EVERY concurrent DB query,
// causing HTTP 429 Too Many Requests and kicking the user out right after login.
//
// Fix: We only re-anchor expires_at when:
//   1. A refresh_token is present (so the SDK CAN renew the session if needed), AND
//   2. The token appears expired by <= CLOCK_SKEW_THRESHOLD_SEC (15 min), indicating
//      a local clock skew rather than a genuinely stale token.
//
// If the token is genuinely expired beyond the threshold, we return it untouched so
// the SDK uses the refresh_token to obtain a fresh session from the server.
const CLOCK_SKEW_THRESHOLD_SEC = 15 * 60; // 15 minutes

const clockSkewCorrectedStorage = {
  getItem: (key: string): string | null => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const refreshToken: string | undefined =
          parsed.refresh_token ?? parsed.session?.refresh_token;
        const expiresIn: number = parsed.expires_in ?? parsed.session?.expires_in ?? 3600;
        const nowSec = Math.floor(Date.now() / 1000);
        const currentExpiresAt: number | undefined =
          parsed.expires_at ?? parsed.session?.expires_at;

        // Only re-anchor when we have a refresh_token AND the apparent expiry is
        // within the clock-skew window (token looks expired but likely isn't).
        // If expired beyond the threshold, the SDK will use refresh_token normally.
        const isApparentlyExpired = !currentExpiresAt || currentExpiresAt <= nowSec;
        const isWithinSkewWindow =
          currentExpiresAt !== undefined &&
          nowSec - currentExpiresAt <= CLOCK_SKEW_THRESHOLD_SEC;
        const canReanchor = !!refreshToken && isApparentlyExpired && isWithinSkewWindow;

        // Also re-anchor when expires_at is completely missing (no server timestamp at all)
        const isMissingExpiry = !currentExpiresAt && !!refreshToken;

        if (canReanchor || isMissingExpiry) {
          const safeExpiresAt = nowSec + expiresIn;
          if ('expires_at' in parsed) parsed.expires_at = safeExpiresAt;
          if (parsed.session && typeof parsed.session === 'object') {
            parsed.session.expires_at = safeExpiresAt;
          }

          const updatedRaw = JSON.stringify(parsed);
          localStorage.setItem(key, updatedRaw);
          return updatedRaw;
        }
      }
      return raw;
    } catch {
      return localStorage.getItem(key);
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object') {
        const expiresIn: number = parsed.expires_in ?? parsed.session?.expires_in ?? 3600;
        const nowSec = Math.floor(Date.now() / 1000);
        // ALWAYS re-anchor expires_at to local_now + expires_in.
        // The server's expires_at is relative to the server clock; if the local
        // PC clock is skewed (ahead or behind), reading it back via getItem would
        // see the token as already-expired, triggering unnecessary refreshes and
        // 401 errors on the very next page load. expires_in (token lifetime in
        // seconds) is clock-independent and safe to use as the anchor.
        const safeExpiresAt = nowSec + expiresIn;

        if (parsed.access_token || 'expires_at' in parsed) {
          parsed.expires_at = safeExpiresAt;
        }
        if (parsed.session && typeof parsed.session === 'object') {
          parsed.session.expires_at = safeExpiresAt;
        }

        localStorage.setItem(key, JSON.stringify(parsed));
        return;
      }
    } catch {
      // Fallback
    }
    localStorage.setItem(key, value);
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Best-effort
    }
  },
};

export const purgeExpiredAuthToken = () => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return false;

    const parsed = JSON.parse(raw);
    const refreshToken: string | undefined =
      parsed?.refresh_token ?? parsed?.session?.refresh_token;

    // Only purge if refresh token is missing. Clock skew adapter keeps expires_at safe.
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

export const markReauthenticationRequired = () => {
  try {
    sessionStorage.setItem(AUTH_RELOGIN_NOTICE_KEY, '1');
  } catch {
    // The login screen remains usable when sessionStorage is unavailable.
  }
};

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
