import { createClient } from '@supabase/supabase-js';
import Cookies from 'js-cookie';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Memory fallback for Supabase session storage in case storage APIs fail or throw
const supabaseMemoryStore = new Map<string, string>();

// High-performance dynamic storage manager
const customStorage = {
  getItem: (key: string) => {
    // 1. Try memory store first
    const memVal = supabaseMemoryStore.get(key);
    if (memVal) return memVal;

    // 2. Try to read from fast client-side web storage
    let val: string | null = null;
    try {
      val = localStorage.getItem(key) || sessionStorage.getItem(key);
    } catch (e) {
      console.warn('[Supabase Client] Failed to read web storage:', e);
    }
    
    // 3. If not found, check if there is an active session in cookies (migration fallback)
    if (!val) {
      try {
        val = Cookies.get(key) || null;
        if (val) {
          // Sync to memory
          supabaseMemoryStore.set(key, val);

          // Migrate to standard web storage immediately to bypass the 4KB cookie limit
          let rememberMe = true;
          try {
            rememberMe = localStorage.getItem('rememberMe') !== 'false';
          } catch (e) {
            // ignore
          }

          try {
            if (rememberMe) {
              localStorage.setItem(key, val);
            } else {
              sessionStorage.setItem(key, val);
            }
          } catch (e) {
            console.warn('[Supabase Client] Failed to write fallback session to storage:', e);
          }
          // Clean up the cookie to prevent sending heavy auth payloads in request headers
          Cookies.remove(key);
        }
      } catch (e) {
        console.warn('[Supabase Client] Failed to access cookies:', e);
      }
    }
    return val;
  },
  setItem: (key: string, value: string) => {
    // Always store in memory for maximum reliability
    supabaseMemoryStore.set(key, value);

    let rememberMe = true;
    try {
      rememberMe = localStorage.getItem('rememberMe') !== 'false';
    } catch (e) {
      // ignore
    }

    try {
      if (rememberMe) {
        localStorage.setItem(key, value);
        sessionStorage.removeItem(key); // Ensure clean separation
      } else {
        sessionStorage.setItem(key, value);
        localStorage.removeItem(key); // Ensure clean separation
      }
    } catch (e) {
      console.warn('[Supabase Client] Failed to write session to storage:', e);
    }

    // Always clean up cookies to prevent duplicate state or header size warnings
    try {
      Cookies.remove(key);
    } catch (e) {
      // ignore
    }
  },
  removeItem: (key: string) => {
    supabaseMemoryStore.delete(key);
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch (e) {
      console.warn('[Supabase Client] Failed to remove session from storage:', e);
    }
    try {
      Cookies.remove(key);
    } catch (e) {
      // ignore
    }
  },
};

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: customStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});