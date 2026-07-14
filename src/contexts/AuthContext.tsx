import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { clearLegacyAuthStorage, markReauthenticationRequired, supabase } from '@/integrations/supabase/client';
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

const isTerminalRefreshError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  return /invalid refresh token|refresh token not found|refresh token revoked|refresh token reuse/i.test(message);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [features, setFeatures] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const profileRef = useRef<AuthProfile | null>(null);

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

      if (profileData) setProfile(profileData);
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
      void fetchProfile(nextSession.user.id);
    }
  }, [clearAuthState, fetchProfile]);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        clearAuthState();
      } else if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        applySession(nextSession);
      }

      setIsLoading(false);
    });

    async function initializeAuth() {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();

        if (error && isTerminalRefreshError(error)) {
          markReauthenticationRequired();
          await supabase.auth.signOut({ scope: 'local' });
          if (mounted) clearAuthState();
          return;
        }

        if (mounted) {
          if (error) {
            console.error('Unable to restore auth session:', error.message);
          }

          applySession(initialSession);
        }
      } catch (error) {
        console.error('Error during auth initialization:', error);
      } finally {
        if (mounted) {
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
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } finally {
      clearLegacyAuthStorage();
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
