import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

import { UserRole } from '@/types';

type AppRole = UserRole;
type Profile = Database['public']['Tables']['profiles']['Row'];

/** Maximum time (ms) to let any single auth network call block startup validation */
const AUTH_NETWORK_TIMEOUT_MS = 5_000;
/** getSession can cold-start or wait on Supabase's auth storage lock, especially in dev StrictMode */
const GET_SESSION_TIMEOUT_MS = 12_000;
/** Maximum time (ms) to let profile/role sync run before staying in cached/offline mode */
const PROFILE_NETWORK_TIMEOUT_MS = 15_000;
/** How often (ms) to validate the session is still alive */
const SESSION_HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const DEFAULT_ROLES: AppRole[] = ['volunteer'];
const LEGACY_PROFILE_CACHE_KEY = 'rtc_cached_profile';
const LEGACY_ROLES_CACHE_KEY = 'rtc_cached_roles';

class TimeoutError extends Error {
  constructor(label: string, timeoutMs: number) {
    super(`${label} timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

const withTimeout = async <T,>(promise: PromiseLike<T>, timeoutMs: number, label: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new TimeoutError(label, timeoutMs)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const profileCacheKey = (userId: string) => `rtc_cached_profile:${userId}`;
const rolesCacheKey = (userId: string) => `rtc_cached_roles:${userId}`;

const clearCachedAuthData = () => {
  Object.keys(localStorage)
    .filter((key) => (
      key === LEGACY_PROFILE_CACHE_KEY ||
      key === LEGACY_ROLES_CACHE_KEY ||
      key.startsWith('rtc_cached_profile:') ||
      key.startsWith('rtc_cached_roles:') ||
      key.startsWith('rtc_dashboard_data_') ||
      key.startsWith('rtc_admin_dashboard_data_') ||
      key.startsWith('rtc_supervisor_dashboard_data_') ||
      key.startsWith('rtc_leader_dashboard_data_') ||
      key.startsWith('rtc_leaderboard_data_') ||
      key.startsWith('rtc_course_schedule_') ||
      key.startsWith('rtc_course_ads_') ||
      key.startsWith('rtc_courses_') ||
      key.startsWith('rtc_my_courses_data_') ||
      key.startsWith('rtc_events_data_') ||
      key.startsWith('rtc_my_events_data_') ||
      key.startsWith('rtc_caravans_data_') ||
      key.startsWith('rtc_trainers_data_') ||
      key.startsWith('rtc_my_quran_circles_data_')
    ))
    .forEach((key) => localStorage.removeItem(key));
};

const readCachedProfile = (userId: string): Profile | null => {
  const candidates = [
    localStorage.getItem(profileCacheKey(userId)),
    localStorage.getItem(LEGACY_PROFILE_CACHE_KEY),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate) as Profile;
      if (parsed?.id === userId) return parsed;
    } catch (err) {
      console.warn('[Auth] Failed to parse cached profile:', err);
    }
  }

  return null;
};

const readCachedRoles = (userId: string): AppRole[] => {
  const candidates = [
    localStorage.getItem(rolesCacheKey(userId)),
    localStorage.getItem(LEGACY_ROLES_CACHE_KEY),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as AppRole[];
    } catch (err) {
      console.warn('[Auth] Failed to parse cached roles:', err);
    }
  }

  return DEFAULT_ROLES;
};

const writeCachedProfile = (userId: string, nextProfile: Profile) => {
  localStorage.setItem(profileCacheKey(userId), JSON.stringify(nextProfile));
  localStorage.removeItem(LEGACY_PROFILE_CACHE_KEY);
};

const writeCachedRoles = (userId: string, nextRoles: AppRole[]) => {
  localStorage.setItem(rolesCacheKey(userId), JSON.stringify(nextRoles));
  localStorage.removeItem(LEGACY_ROLES_CACHE_KEY);
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  isAuthenticated: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  primaryRole: AppRole;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Helper to clear user-specific SW caches on sign-out to prevent data crossover */
const clearUserCaches = async () => {
  if ('caches' in window) {
    try {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.includes('api') || name.includes('dynamic'))
          .map((name) => caches.delete(name))
      );
      console.log('[Auth Cache] Purged api and dynamic caches on signout');
    } catch (err) {
      console.error('[Auth Cache] Error purging SW cache:', err);
    }
  }
};

/** Helper to synchronously read the stored Supabase session from localStorage */
const getStoredSession = (): Session | null => {
  try {
    const keys = Object.keys(localStorage);
    const tokenKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (!tokenKey) return null;
    const sessionStr = localStorage.getItem(tokenKey);
    if (!sessionStr) return null;
    const parsed = JSON.parse(sessionStr);
    return (parsed?.currentSession || parsed?.session || parsed) as Session;
  } catch (e) {
    console.error('[Auth] Error reading stored session from localStorage:', e);
    return null;
  }
};

type ErrorLike = {
  message?: string;
  status?: string | number;
  code?: string | number;
  name?: string;
};

const toErrorLike = (error: unknown): ErrorLike => {
  if (typeof error === 'object' && error !== null) return error as ErrorLike;
  if (typeof error === 'string') return { message: error };
  return {};
};

const isAuthRejection = (error: unknown): boolean => {
  if (!error) return false;
  const errorLike = toErrorLike(error);
  const msg = errorLike.message?.toLowerCase() || '';
  const status = errorLike.status || errorLike.code;

  return (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    status === '400' ||
    status === '401' ||
    status === '403' ||
    status === 'PGRST301' ||
    msg.includes('jwt') ||
    msg.includes('invalid token') ||
    msg.includes('invalid refresh token') ||
    msg.includes('refresh token') ||
    msg.includes('expired') ||
    msg.includes('not authenticated')
  );
};

/** Helper to identify network-level errors to protect against incorrect sign-outs */
const isNetworkError = (error: unknown): boolean => {
  if (!error) return false;
  const errorLike = toErrorLike(error);
  if (error instanceof TimeoutError || errorLike.name === 'TimeoutError') return true;
  const msg = errorLike.message?.toLowerCase() || '';
  const status = errorLike.status || errorLike.code;

  // Explicit HTTP auth error codes mean the server rejected us (not a network error)
  if (isAuthRejection(error) || status === '400') {
    return false;
  }

  if (
    msg.includes('failed to fetch') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('network error') ||
    msg.includes('networkerror') ||
    msg.includes('unreachable') ||
    msg.includes('cors') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    (typeof navigator !== 'undefined' && !navigator.onLine)
  ) {
    return true;
  }

  return false;
};

const isTimeoutError = (error: unknown): boolean => {
  const errorLike = toErrorLike(error);
  return error instanceof TimeoutError || errorLike.name === 'TimeoutError';
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Refs to avoid stale closure captures in callbacks
  const profileRef = useRef<Profile | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const isSigningOutRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);
  const fetchingProfileForRef = useRef<string | null>(null);

  // Keep refs in sync with state
  useEffect(() => { profileRef.current = profile; }, [profile]);
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => {
    const nextUserId = user?.id ?? null;
    if (lastUserIdRef.current && nextUserId && lastUserIdRef.current !== nextUserId) {
      queryClient.clear();
    }
    lastUserIdRef.current = nextUserId;
  }, [queryClient, user?.id]);

  // ─── Clean sign-out helper (shared by all error recovery paths) ────
  const cleanSignOut = useCallback(async (reason: string) => {
    if (isSigningOutRef.current) return;
    isSigningOutRef.current = true;
    console.warn(`[Auth] Clean sign-out triggered: ${reason}`);

    // Update state first so the UI responds instantly and exits loading states
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setIsLoading(false);
    isSigningOutRef.current = false;
    queryClient.clear();

    // Clear cached user data
    clearCachedAuthData();

    // Trigger cleanup and server sign-out in the background to prevent network/cache deadlocks
    clearUserCaches();
    supabase.auth.signOut().catch((err) => {
      console.error('[Auth] Background sign-out error:', err);
    });
  }, [queryClient]);

  // ─── Profile & roles fetching ──────────────────────────────────────
  const fetchProfile = useCallback(async (userId: string): Promise<boolean> => {
    if (fetchingProfileForRef.current === userId) {
      console.log('[Auth] fetchProfile already in progress for user:', userId);
      return true;
    }
    fetchingProfileForRef.current = userId;
    try {
      const [profileRes, rolesRes] = await withTimeout(
        Promise.all([
          supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle(),
          supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', userId)
        ]),
        PROFILE_NETWORK_TIMEOUT_MS,
        'profile/roles fetch'
      );

      if (profileRes.error) {
        // 401/403 means the session is invalid — server rejected our token
        if (isAuthRejection(profileRes.error)) {
          console.error('[Auth] Profile fetch returned auth error — session is stale');
          return false; // Signal caller to clean sign out
        }
        console.error('Error fetching profile:', profileRes.error);
      } else if (profileRes.data) {
        setProfile(profileRes.data);
        writeCachedProfile(userId, profileRes.data);
      }

      if (rolesRes.error) {
        if (isAuthRejection(rolesRes.error)) {
          console.error('[Auth] Roles fetch returned auth error — session is stale');
          return false;
        }
        console.error('Error fetching roles:', rolesRes.error);
      } else if (rolesRes.data && rolesRes.data.length > 0) {
        const roleList = rolesRes.data.map(r => r.role as AppRole);
        setRoles(roleList);
        writeCachedRoles(userId, roleList);
      } else {
        setRoles(DEFAULT_ROLES);
        writeCachedRoles(userId, DEFAULT_ROLES);
      }
      return true; // Success
    } catch (error) {
      if (isNetworkError(error)) {
        console.warn('[Auth] Profile sync deferred; network/timeout error:', error);
        return true;
      }
      console.error('Error in fetchProfile:', error);
      return !isAuthRejection(error);
    } finally {
      if (fetchingProfileForRef.current === userId) {
        fetchingProfileForRef.current = null;
      }
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  // ─── Auth initialization ───────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        // Step 1: Read synchronous cached state from localStorage first to restore UI instantly
        const storedSession = getStoredSession();
        let hydratedFromStorage = false;

        if (storedSession && storedSession.user) {
          const cachedProfile = readCachedProfile(storedSession.user.id);
          const cachedRoles = readCachedRoles(storedSession.user.id);

          setSession(storedSession);
          setUser(storedSession.user);
          setProfile(cachedProfile);
          setRoles(cachedRoles);
          setIsLoading(false);
          hydratedFromStorage = true;
          console.log('[Auth] Hydrated from local session cache; validating in background.');
        } else {
          setIsLoading(false);
          console.log('[Auth] No local session found; setting isLoading to false immediately.');
        }

        // Step 2: Fetch the active session from Supabase Client. This may refresh an
        // expired access token, so it is bounded and never owns the loading screen.
        let initialSession: Session | null = null;
        try {
          const { data } = await withTimeout(
            supabase.auth.getSession(),
            GET_SESSION_TIMEOUT_MS,
            'getSession'
          );
          initialSession = data.session;
        } catch (err) {
          if (isTimeoutError(err)) {
            console.info(`[Auth] getSession exceeded ${GET_SESSION_TIMEOUT_MS}ms; continuing with cached/offline state.`);
          } else if (isNetworkError(err)) {
            console.info('[Auth] getSession unavailable; continuing with cached/offline state.');
          } else {
            console.warn('[Auth] getSession failed during startup validation:', err);
          }
          if (hydratedFromStorage) {
            console.info('[Auth] Continuing with cached session; will retry validation later.');
            return;
          }
        }

        if (!mounted) return;

        if (initialSession) {
          console.log('[Auth] Supabase session verified:', initialSession.user.id);
          if (!hydratedFromStorage) {
            setSession(initialSession);
            setUser(initialSession.user);
            setProfile(readCachedProfile(initialSession.user.id));
            setRoles(readCachedRoles(initialSession.user.id));
            setIsLoading(false);
          }

          // Step 3: Fetch fresh user details and profile in parallel
          const [userRes, profileOk] = await Promise.allSettled([
            withTimeout(
              supabase.auth.getUser(),
              AUTH_NETWORK_TIMEOUT_MS,
              'getUser'
            ),
            fetchProfile(initialSession.user.id)
          ]);

          if (!mounted) return;

          if (userRes.status === 'rejected') {
            if (isNetworkError(userRes.reason)) {
              console.warn('[Auth] User validation deferred; keeping cached/session state.');
              return;
            }

            if (isAuthRejection(userRes.reason)) {
              await cleanSignOut('Stale session detected on startup');
              return;
            }

            console.warn('[Auth] Unexpected user validation error; keeping session:', userRes.reason);
            return;
          }

          const userValidation = userRes.value;
          if (userValidation.error || !userValidation.data.user) {
            const isNetworkErr = isNetworkError(userValidation.error);
            if (isNetworkErr) {
              console.warn('[Auth] Network error validating user session. Keeping session.');
              return;
            } else if (isAuthRejection(userValidation.error)) {
              console.warn('[Auth] Stored session is stale (server rejected it). Cleaning up.');
              await cleanSignOut('Stale session detected on startup');
              return;
            }

            console.warn('[Auth] User validation returned no user; keeping cached state until retry.');
            return;
          }

          if (profileOk.status === 'fulfilled' && !profileOk.value) {
            // Profile fetch returned a hard authentication error (e.g. 401)
            await cleanSignOut('Profile fetch returned auth error on startup');
            return;
          }

          // Hydrate/Update state with fresh data
          setSession(initialSession);
          setUser(userValidation.data.user);
        } else {
          // We definitively received no session (user is logged out)
          console.log('[Auth] No session found on startup');
          // Clear any stale cached profile/roles.
          clearCachedAuthData();
          setUser(null);
          setSession(null);
          setProfile(null);
          setRoles([]);
        }
      } catch (error) {
        console.error('[Auth] Error during auth initialization:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    initializeAuth();

    // ─── Auth state change listener ────────────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent | string, newSession) => {
        if (!mounted) return;

        console.log('[Auth] Auth state change:', event);

        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          setSession(newSession);
          setUser(newSession?.user ?? null);
          if (newSession?.user) {
            // Use ref to avoid stale closure — only fetch if profile is missing or for a different user
            const currentProfile = profileRef.current;
            if (!currentProfile || currentProfile.id !== newSession.user.id) {
              const profileOk = await fetchProfile(newSession.user.id);
              if (!profileOk && mounted) {
                await cleanSignOut('Profile fetch failed after auth state change');
                return;
              }
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setProfile(null);
          setRoles([]);
          setIsLoading(false);
        } else if (event === 'TOKEN_REFRESH_ERROR') {
          try {
            const { data: { user: validatedUser }, error } = await withTimeout(
              supabase.auth.getUser(),
              AUTH_NETWORK_TIMEOUT_MS,
              'refresh-error validation'
            );

            if (error || !validatedUser) {
              if (isNetworkError(error)) {
                console.warn('[Auth] Token refresh failed during network trouble; keeping cached session.');
              } else {
                await cleanSignOut('TOKEN_REFRESH_ERROR — refresh token expired');
              }
            }
          } catch (err) {
            if (isNetworkError(err)) {
              console.warn('[Auth] Token refresh validation timed out; keeping cached session.');
            } else {
              await cleanSignOut('TOKEN_REFRESH_ERROR — refresh token expired');
            }
          }
          return;
        }

        // Ensure loading is false after any auth event
        if (mounted) {
          setIsLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, cleanSignOut]);

  // ─── Visibility-change health check ────────────────────────────────
  // When the user returns to the tab after a period of inactivity,
  // validate their session is still alive. This catches expired tokens
  // before the user interacts and hits mysterious 401s.
  useEffect(() => {
    let lastCheck = Date.now();

    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;
      if (!sessionRef.current) return; // Not logged in

      // Only check if enough time has passed since the last health check
      const now = Date.now();
      if (now - lastCheck < SESSION_HEALTH_CHECK_INTERVAL_MS) return;
      lastCheck = now;

      console.log('[Auth] Tab became visible — validating session...');
      try {
        const { data: { user: validatedUser }, error } = await withTimeout(
          supabase.auth.getUser(),
          AUTH_NETWORK_TIMEOUT_MS,
          'visibility session check'
        );
        if (error || !validatedUser) {
          if (isNetworkError(error)) {
            console.warn('[Auth] Visibility check hit network trouble; keeping cached session.');
          } else {
            console.warn('[Auth] Session expired while tab was inactive');
            await cleanSignOut('Session expired during inactivity (visibility check)');
          }
        }
      } catch (err) {
        if (isNetworkError(err)) {
          console.warn('[Auth] Visibility check failed (network/timeout) — will retry later');
        } else {
          await cleanSignOut('Visibility check returned auth rejection');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [cleanSignOut]);

  // ─── Heartbeat: update last_seen_at ────────────────────────────────
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const updateLastSeen = async (uid: string) => {
      try {
        await withTimeout(
          supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', uid),
          AUTH_NETWORK_TIMEOUT_MS,
          'last_seen heartbeat'
        );
      } catch { /* silent */ }
    };

    if (user?.id) {
      // Update immediately
      updateLastSeen(user.id);
      // Then every 2 minutes
      heartbeatRef.current = setInterval(() => updateLastSeen(user.id), 2 * 60 * 1000);
    }

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [user?.id]);

  const signOut = useCallback(async () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }

    // Update state first so the UI responds instantly
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setIsLoading(false);
    queryClient.clear();

    // Clear cached user data
    clearCachedAuthData();

    // Trigger cleanup and server sign-out in the background to prevent network/cache deadlocks
    clearUserCaches();
    supabase.auth.signOut().catch((err) => {
      console.error('[Auth] Background sign-out error:', err);
    });
  }, [queryClient]);

  const hasRole = useCallback((role: AppRole) => {
    return roles.includes(role);
  }, [roles]);

  // Determine primary role (highest privilege) - memoized
  const primaryRole = useMemo((): AppRole => {
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('executive')) return 'executive';
    if (roles.includes('branch_admin')) return 'branch_admin';
    if (roles.includes('head_hr')) return 'head_hr';
    if (roles.includes('hr')) return 'hr';
    if (roles.includes('supervisor')) return 'supervisor';
    if (roles.includes('committee_leader')) return 'committee_leader';
    if (roles.includes('head_production')) return 'head_production';
    if (roles.includes('head_fourth_year')) return 'head_fourth_year';
    if (roles.includes('head_caravans')) return 'head_caravans';
    if (roles.includes('head_events')) return 'head_events';
    if (roles.includes('head_ethics')) return 'head_ethics';
    if (roles.includes('head_quran')) return 'head_quran';
    if (roles.includes('head_marketing')) return 'head_marketing';
    if (roles.includes('head_ashbal')) return 'head_ashbal';

    return 'volunteer';
  }, [roles]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    user,
    session,
    profile,
    roles,
    isAuthenticated: !!user,
    isLoading,
    signOut,
    refreshProfile,
    hasRole,
    primaryRole,
  }), [user, session, profile, roles, isLoading, signOut, refreshProfile, hasRole, primaryRole]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
