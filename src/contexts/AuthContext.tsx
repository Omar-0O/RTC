import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [features, setFeatures] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const profileRef = useRef<AuthProfile | null>(null);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

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

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        // Check for an active session first
        const { data: { session: initialSession } } = await supabase.auth.getSession();

        if (mounted) {
          if (initialSession) {
            setSession(initialSession);
            setUser(initialSession.user);
            // Verify profile immediately if we have a session
            fetchProfile(initialSession.user.id);
          }
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent | string, session) => {
        if (!mounted) return;

        if (event === 'TokenRefreshed' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) {
            // Only fetch profile if we don't have it or it's different
            const currentProfile = profileRef.current;
            if (!currentProfile || currentProfile.id !== session.user.id) {
              fetchProfile(session.user.id);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setProfile(null);
          setRoles([]);
          setFeatures([]);
          setIsLoading(false);
        } else if (event === 'TOKEN_REFRESH_ERROR') {
          console.error('Token refresh error occurred');
          // Do not immediately sign out, let the session expire naturally or wait for next action
          // but user might need to re-login next time they try an action
        }

        // Ensure loading is false after any auth event if it wasn't already
        setIsLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // Heartbeat: update last_seen_at on login and every 2 minutes
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const updateLastSeen = async (uid: string) => {
      try {
        await supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', uid);
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
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setFeatures([]);
  }, []);

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
