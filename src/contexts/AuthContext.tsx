import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { AUTH_STORAGE_KEY, clearLegacyAuthStorage, markReauthenticationRequired, supabase } from '@/integrations/supabase/client';
import { useProfileHeartbeat } from '@/hooks/useProfileHeartbeat';
import { getAuthData, type AuthProfile } from '@/services/auth.service';
import { getPrimaryRole } from '@/utils/roles';
import type { UserRole } from '@/types';

type AppRole = UserRole;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: AuthProfile | null;
  roles: AppRole[];
  features: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  primaryRole: AppRole;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── 429 Circuit Breaker ──────────────────────────────────────────────────────
// When Supabase returns 429 (Too Many Requests) on a refresh-token call, we
// record the timestamp and block all further auth initialization attempts for
// CIRCUIT_OPEN_MS milliseconds. This prevents a retry storm that compounds the
// rate-limit problem across re-renders and concurrent calls.
const CIRCUIT_OPEN_MS = 60_000; // 1 minute
let circuitOpenUntil = 0;
const isCircuitOpen = () => Date.now() < circuitOpenUntil;
const openCircuit = () => { circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS; };

const isTerminalRefreshError = (error: unknown) => {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String((error as { message?: string })?.message || error);
  const status = (error as { status?: number })?.status;

  return (
    status === 429 ||
    status === 400 ||
    /invalid refresh token|refresh token not found|refresh token revoked|refresh token reuse|too many requests|429/i.test(message)
  );
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [features, setFeatures] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const profileRef = useRef<AuthProfile | null>(null);
  // Tracks whether an async profile fetch (triggered inside applySession) is still in-flight.
  // We use a ref instead of state to avoid triggering an extra re-render.
  const pendingProfileFetch = useRef<Promise<void> | null>(null);

  const clearAuthState = useCallback(() => {
    profileRef.current = null;
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setFeatures([]);
  }, []);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useProfileHeartbeat(user?.id);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { profile: profileData, roles: userRoles, features: userFeatures, rolesError } = await getAuthData(userId);
      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
      }

      if (profileData) {
        profileRef.current = profileData;
        setProfile(profileData);
      }
      setRoles(userRoles);
      setFeatures(userFeatures);
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  const applySession = useCallback((nextSession: Session | null) => {
    if (!nextSession) {
      clearAuthState();
      return;
    }

    setSession(nextSession);
    setUser(nextSession.user);

    const currentProfile = profileRef.current;
    if (!currentProfile || currentProfile.id !== nextSession.user.id) {
      // Defer profile fetch by one tick so the SDK fully settles the new
      // session/token before we fire DB queries that call _getAccessToken
      // internally. Firing them synchronously inside onAuthStateChange can
      // trigger a refresh attempt on a token that was just written, causing
      // 429 rate-limit errors on the Supabase auth endpoint.
      //
      // We store the pending promise so that the caller (onAuthStateChange /
      // initializeAuth) can await it before clearing the global isLoading flag.
      // This prevents the app from rendering with profile = null on first open.
      pendingProfileFetch.current = new Promise<void>((resolve) => {
        setTimeout(() => {
          void fetchProfile(nextSession.user.id).finally(resolve);
        }, 0);
      });
    }
  }, [clearAuthState, fetchProfile]);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        clearAuthState();
        setIsLoading(false);
      } else if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        applySession(nextSession);
        // Wait for the profile fetch (started inside applySession) to finish
        // before clearing isLoading. This prevents the brief flash where the
        // app renders with profile = null immediately after a session restore.
        const pending = pendingProfileFetch.current;
        if (pending) {
          void pending.finally(() => {
            pendingProfileFetch.current = null;
            if (mounted) setIsLoading(false);
          });
        } else {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    });

    async function initializeAuth() {
      if (isCircuitOpen()) {
        console.warn('[Auth] Circuit open due to recent 429 rate-limit. Skipping session initialization.');
        markReauthenticationRequired();
        clearLegacyAuthStorage();
        try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch { /* ignore */ }
        if (mounted) {
          clearAuthState();
          setIsLoading(false);
        }
        return;
      }

      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();

        if (error) {
          const is429 = isTerminalRefreshError(error);
          if (is429) {
            openCircuit();
          }
          console.error(
            is429
              ? '[Auth] Rate-limited (429) during session restore. Clearing storage to stop refresh loop.'
              : 'Unable to restore auth session:',
            error.message
          );
          // Directly remove the bad token from storage WITHOUT firing signOut events.
          // Calling signOut triggers _notifyAllSubscribers which can cause the SDK
          // to attempt another refresh_token call, worsening 429 rate-limit issues.
          markReauthenticationRequired();
          clearLegacyAuthStorage();
          // Also clear the main auth token to fully stop any pending refresh.
          try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch { /* ignore */ }
          if (mounted) {
            clearAuthState();
            setIsLoading(false);
          }
          return;
        }

        if (mounted) {
          applySession(initialSession);
          // isLoading will be cleared by onAuthStateChange once the profile fetch completes.
          // No need to setIsLoading(false) here.
        }
      } catch (error) {
        console.error('Error during auth initialization:', error);
        clearLegacyAuthStorage();
        if (mounted) {
          clearAuthState();
          setIsLoading(false);
        }
      }
    }

    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [applySession, clearAuthState]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn('SignOut warning:', error);
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // ignore fallback errors
      }
    } finally {
      clearAuthState();
    }
  }, [clearAuthState]);

  const hasRole = useCallback((role: AppRole) => {
    return roles.includes(role);
  }, [roles]);

  // Determine primary role (highest privilege) - memoized
  const primaryRole = useMemo(() => getPrimaryRole(roles), [roles]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    user,
    session,
    profile,
    roles,
    features,
    isAuthenticated: !!user,
    isLoading,
    signOut,
    refreshProfile,
    hasRole,
    primaryRole,
  }), [user, session, profile, roles, features, isLoading, signOut, refreshProfile, hasRole, primaryRole]);

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
