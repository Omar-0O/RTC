import { createClient } from '@supabase/supabase-js';
import Cookies from 'js-cookie';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// High-performance dynamic storage manager
const customStorage = {
  getItem: (key: string) => {
    // 1. Try to read from fast client-side web storage first
    let val = localStorage.getItem(key) || sessionStorage.getItem(key);
    
    // 2. If not found, check if there is an active session in cookies (migration fallback)
    if (!val) {
      val = Cookies.get(key) || null;
      if (val) {
        // Migrate to standard web storage immediately to bypass the 4KB cookie limit
        const rememberMe = localStorage.getItem('rememberMe') !== 'false';
        if (rememberMe) {
          localStorage.setItem(key, val);
        } else {
          sessionStorage.setItem(key, val);
        }
        // Clean up the cookie to prevent sending heavy auth payloads in request headers
        Cookies.remove(key);
      }
    }
    return val;
  },
  setItem: (key: string, value: string) => {
    const rememberMe = localStorage.getItem('rememberMe') !== 'false';
    if (rememberMe) {
      localStorage.setItem(key, value);
      sessionStorage.removeItem(key); // Ensure clean separation
    } else {
      sessionStorage.setItem(key, value);
      localStorage.removeItem(key); // Ensure clean separation
    }
    // Always clean up cookies to prevent duplicate state or header size warnings
    Cookies.remove(key);
  },
  removeItem: (key: string) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
    Cookies.remove(key);
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