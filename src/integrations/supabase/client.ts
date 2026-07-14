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
  },
});
