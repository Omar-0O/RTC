import { createClient } from '@supabase/supabase-js';
import Cookies from 'js-cookie';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const cookieStorage = {
  getItem: (key: string) => {
    return Cookies.get(key) || null;
  },
  setItem: (key: string, value: string) => {
    // Check if user wanted to be remembered
    const rememberMe = localStorage.getItem('rememberMe') === 'true';
    if (rememberMe) {
      Cookies.set(key, value, { expires: 30, secure: true, sameSite: 'strict' });
    } else {
      Cookies.set(key, value, { secure: true, sameSite: 'strict' }); // Session cookie
    }
  },
  removeItem: (key: string) => {
    Cookies.remove(key);
  },
};

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: cookieStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});