import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

import { UserRole } from '@/types';

type AppRole = UserRole;
type Profile = Database['public']['Tables']['profiles']['Row'];

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        return;
      }

      if (profileData) {
        setProfile(profileData);
      }

      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
        return;
      }

      if (rolesData && rolesData.length > 0) {
        setRoles(rolesData.map(r => r.role as AppRole));
      } else {
        setRoles(['volunteer']);
      }
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
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent | string, session) => {
        console.log('Auth state change:', event, session?.user?.id);

        if (event === 'TOKEN_REFRESH_ERROR') {
          console.error('Token refresh error, signing out...');
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setProfile(null);
          setRoles([]);
          setIsLoading(false);
          return;
        }

        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setProfile(null);
          setRoles([]);
          setIsLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        // Defer profile fetch with setTimeout to avoid deadlock
        if (session?.user) {
          // Only fetch if profile is not already loaded or user changed
          if (!profile || profile.id !== session.user.id) {
            setTimeout(() => {
              fetchProfile(session.user.id);
            }, 0);
          }
        } else {
          setProfile(null);
          setRoles([]);
        }

        setIsLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]); // Removed profile dependency to avoid effect loops, logic inside handles checks

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
  }, []);

  const hasRole = useCallback((role: AppRole) => {
    return roles.includes(role);
  }, [roles]);

  // Determine primary role (highest privilege) - memoized
  const primaryRole = useMemo((): AppRole => {
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('head_hr')) return 'head_hr';
    if (roles.includes('hr')) return 'hr';
    if (roles.includes('supervisor')) return 'supervisor';
    if (roles.includes('committee_leader')) return 'committee_leader';
    if (roles.includes('head_production')) return 'head_production';
    if (roles.includes('head_fourth_year')) return 'head_fourth_year';
    if (roles.includes('head_caravans')) return 'head_caravans';
    if (roles.includes('head_events')) return 'head_events';
    if (roles.includes('head_ethics')) return 'head_ethics';
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
