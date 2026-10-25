import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import {
  getStoredSessionSnapshot,
  isRateLimitOrTransientAuthError,
  isRevokedTokenError,
  purgeSessionAndMarkReauth,
  supabase,
} from '@/integrations/supabase/client';
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
// record the timestamp and pause further auth refresh attempts for
// CIRCUIT_OPEN_MS milliseconds while preserving the stored session in localStorage.
const CIRCUIT_OPEN_MS = 60_000; // 1 minute
let circuitOpenUntil = 0;
const isCircuitOpen = () => Date.now() < circuitOpenUntil;
const openCircuit = () => { circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS; };

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
      // internally.
      pendingProfileFetch.current = new Promise<void>((resolve) => {
        setTimeout(() => {
          void fetchProfile(nextSession.user.id).finally(resolve);
        }, 0);
      });
    }
  }, [clearAuthState, fetchProfile]);

  useEffect(() => {
    let mounted = true;

    const finishLoadingAfterProfile = () => {
      const pending = pendingProfileFetch.current;
      if (pending) {
        void pending.finally(() => {
          pendingProfileFetch.current = null;
          if (mounted) setIsLoading(false);
        });
      } else if (mounted) {
        setIsLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        clearAuthState();
        setIsLoading(false);
      } else if (
        event === 'TOKEN_REFRESHED' ||
        event === 'SIGNED_IN' ||
        event === 'INITIAL_SESSION' ||
        event === 'USER_UPDATED'
      ) {
        if (!nextSession && event === 'INITIAL_SESSION') {
          // If INITIAL_SESSION arrives as null due to a transient offline/rate-limit error,
          // let initializeAuth inspect storage before clearing state.
          return;
        }
        applySession(nextSession);
        finishLoadingAfterProfile();
      } else {
        setIsLoading(false);
      }
    });

    async function initializeAuth() {
      const storedBefore = getStoredSessionSnapshot();

      if (isCircuitOpen()) {
        console.warn('[Auth] Rate-limit cooldown active. Hydrating from stored session without network refresh.');
        if (mounted) {
          applySession(storedBefore);
          finishLoadingAfterProfile();
        }
        return;
      }

      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();

        if (error) {
          const storedAfter = getStoredSessionSnapshot();

          // 1. Check if another tab concurrently rotated the session while getSession() was in flight
          if (
            storedAfter &&
            ((storedBefore && storedAfter.refresh_token !== storedBefore.refresh_token) ||
              (typeof storedAfter.expires_at === 'number' && storedAfter.expires_at * 1000 > Date.now()))
          ) {
            if (mounted) {
              applySession(storedAfter);
              finishLoadingAfterProfile();
            }
            return;
          }

          // 2. Transient network error, offline state, or HTTP 429 rate-limit:
          // NEVER destroy the stored refresh_token! Keep the user signed in with the
          // cached session snapshot so auto-refresh can recover once back online.
          if (isRateLimitOrTransientAuthError(error) || (typeof navigator !== 'undefined' && !navigator.onLine)) {
            if (isRateLimitOrTransientAuthError(error)) {
              openCircuit();
            }
            console.warn(
              '[Auth] Transient network or rate-limit error during session restore; preserving stored session:',
              error.message
            );
            const fallbackSession = storedAfter ?? storedBefore;
            if (mounted) {
              applySession(fallbackSession);
              finishLoadingAfterProfile();
            }
            return;
          }

          // 3. Genuinely revoked / invalid refresh token:
          if (isRevokedTokenError(error)) {
            console.warn('[Auth] Refresh token rejected by server:', error.message);
            const didPurge = purgeSessionAndMarkReauth({
              failedRefreshToken: storedBefore?.refresh_token,
            });
            if (!didPurge) {
              const latestSession = getStoredSessionSnapshot();
              if (latestSession && mounted) {
                applySession(latestSession);
                finishLoadingAfterProfile();
                return;
              }
            }
          } else {
            console.error('Unable to restore auth session:', error.message);
          }

          if (mounted) {
            clearAuthState();
            setIsLoading(false);
          }
          return;
        }

        if (mounted) {
          applySession(initialSession);
          finishLoadingAfterProfile();
        }
      } catch (error) {
        console.error('Error during auth initialization:', error);
        const fallbackSession = getStoredSessionSnapshot() ?? storedBefore;
        if (
          (isRateLimitOrTransientAuthError(error) || (typeof navigator !== 'undefined' && !navigator.onLine)) &&
          fallbackSession
        ) {
          if (mounted) {
            applySession(fallbackSession);
            finishLoadingAfterProfile();
          }
          return;
        }

        if (isRevokedTokenError(error)) {
          purgeSessionAndMarkReauth({ failedRefreshToken: storedBefore?.refresh_token });
        }
        if (mounted) {
          clearAuthState();
          setIsLoading(false);
        }
      }
    }

    void initializeAuth();

    // Recover session seamlessly when returning online after sleep or Wi-Fi switch
    const handleOnline = () => {
      if (!mounted || isCircuitOpen()) return;
      void supabase.auth.getSession().then(({ data: { session: refreshedSession } }) => {
        if (mounted && refreshedSession) {
          applySession(refreshedSession);
        }
      }).catch(() => {
        // Ignore transient reconnect errors
      });
    };

    window.addEventListener('online', handleOnline);

    return () => {
      mounted = false;
      window.removeEventListener('online', handleOnline);
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
