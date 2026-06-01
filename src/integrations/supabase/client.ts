import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Unified auth storage — ALWAYS uses localStorage.
 *
 * Previous versions split tokens between localStorage / sessionStorage
 * based on a `rememberMe` flag, which caused sessions to silently vanish
 * when the flag was cleared or storage was evicted. This unified approach
 * eliminates the split-brain problem entirely.
 *
 * One-time migration: pulls any existing session from sessionStorage or
 * cookies into localStorage so existing users aren't logged out.
 */
const unifiedStorage = {
  getItem: (key: string): string | null => {
    // 1. Primary source — always localStorage
    let val = localStorage.getItem(key);

    // 2. One-time migration from sessionStorage (legacy rememberMe=false)
    if (!val) {
      val = sessionStorage.getItem(key) || null;
      if (val) {
        localStorage.setItem(key, val);
        sessionStorage.removeItem(key);
        console.log('[Auth Storage] Migrated token from sessionStorage → localStorage');
      }
    }

    // 3. One-time migration from cookies (very old sessions)
    if (!val) {
      try {
        // Read cookie without js-cookie dependency
        const match = document.cookie.match(new RegExp(`(?:^|; )${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`));
        val = match ? decodeURIComponent(match[1]) : null;
        if (val) {
          localStorage.setItem(key, val);
          // Clear the cookie
          document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
          console.log('[Auth Storage] Migrated token from cookie → localStorage');
        }
      } catch {
        // Cookie parsing failed — not critical
      }
    }

    return val;
  },

  setItem: (key: string, value: string): void => {
    localStorage.setItem(key, value);
    // Clean up any legacy storage to prevent stale duplicates
    sessionStorage.removeItem(key);
  },

  removeItem: (key: string): void => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
    // Clean up any legacy cookie
    try {
      document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    } catch {
      // Not critical
    }
  },
};

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: unifiedStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});