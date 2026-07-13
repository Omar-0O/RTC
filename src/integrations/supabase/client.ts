import { createClient } from '@supabase/supabase-js';
import Cookies from 'js-cookie';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Keeps the current browser session usable when web storage is unavailable.
const sessionMemoryStore = new Map<string, string>();

// High-performance dynamic storage manager
const customStorage = {
  getItem: (key: string) => {
    const memoryValue = sessionMemoryStore.get(key);
    if (memoryValue) return memoryValue;

    let value: string | null = null;
    try {
      value = localStorage.getItem(key) || sessionStorage.getItem(key);
    } catch {
      // Private browsing or restrictive browser settings can reject web storage.
    }

    if (value) {
      sessionMemoryStore.set(key, value);
      return value;
    }
    
    try {
      value = Cookies.get(key) || null;
      if (value) {
        sessionMemoryStore.set(key, value);

        try {
          const rememberMe = localStorage.getItem('rememberMe') !== 'false';
          if (rememberMe) {
            localStorage.setItem(key, value);
          } else {
            sessionStorage.setItem(key, value);
          }
        } catch {
          // Memory storage remains available for this browser session.
        }

        Cookies.remove(key);
      }
    } catch {
      // Cookie access is optional migration support only.
    }

    return value;
  },
  setItem: (key: string, value: string) => {
    sessionMemoryStore.set(key, value);

    try {
      const rememberMe = localStorage.getItem('rememberMe') !== 'false';
      if (rememberMe) {
        localStorage.setItem(key, value);
        sessionStorage.removeItem(key);
      } else {
        sessionStorage.setItem(key, value);
        localStorage.removeItem(key);
      }
    } catch {
      // Memory storage remains available for this browser session.
    }

    try {
      Cookies.remove(key);
    } catch {
      // Cookie cleanup is best-effort.
    }
  },
  removeItem: (key: string) => {
    sessionMemoryStore.delete(key);
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {
      // The in-memory copy was already cleared.
    }

    try {
      Cookies.remove(key);
    } catch {
      // Cookie cleanup is best-effort.
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
