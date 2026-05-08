import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { invalidateBranchCache } from '@/services/branchGuard';

export interface Branch {
  id: string;
  name: string;
  name_ar: string;
  is_default: boolean;
  code?: string;
}

interface BranchContextType {
  branches: Branch[];
  /** The authenticated user's ACTUAL branch (from DB — authoritative) */
  userBranchId: string | null;
  /** The branch currently being viewed. For non-admin, always === userBranchId.
   *  For admin, can be switched for UI filtering (does NOT affect security). */
  activeBranch: Branch | null;
  /** Only admin/executive may call this */
  setActiveBranch: (branch: Branch | null) => void;
  isLoading: boolean;
  refreshBranches: () => Promise<void>;
  /** true for admin and executive — they see all branches without filtering */
  canViewAllBranches: boolean;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

/** Roles that can see data from ALL branches */
const ALL_BRANCH_ROLES = ['admin', 'executive'] as const;

export const BranchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, primaryRole } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranch, setActiveBranchState] = useState<Branch | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /** The user's authoritative branch from their profile — NEVER overridable */
  const userBranchId = useMemo(() => (profile as any)?.branch_id || null, [profile]);

  const canViewAllBranches = useMemo(
    () => ALL_BRANCH_ROLES.includes(primaryRole as any),
    [primaryRole]
  );

  const fetchBranches = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await (supabase as any)
        .from('branches')
        .select('*');

      if (error) throw error;
      
      if (data) {
        setBranches(data as Branch[]);
      }
    } catch (error) {
      console.error('Error fetching branches:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update active branch based on role
  useEffect(() => {
    if (branches.length === 0) return;

    if (canViewAllBranches) {
      // admin / executive: can switch branches freely, restore from localStorage
      const savedBranchId = localStorage.getItem('active_branch_id');
      const savedBranch = savedBranchId ? branches.find(b => b.id === savedBranchId) : null;
      setActiveBranchState(savedBranch || branches[0]);
    } else {
      // ALL other roles: locked to their profile's branch_id — NO override possible
      let branchToUse = branches[0];
      if (userBranchId) {
        const userBranch = branches.find(b => b.id === userBranchId);
        if (userBranch) branchToUse = userBranch;
      }
      setActiveBranchState(branchToUse);
      // Clear any stale localStorage for non-admin users
      localStorage.removeItem('active_branch_id');
    }
  }, [branches, userBranchId, canViewAllBranches]);

  // Invalidate branch guard cache on auth changes
  useEffect(() => {
    invalidateBranchCache();
  }, [user?.id]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const setActiveBranch = useCallback((branch: Branch | null) => {
    // SECURITY: Only admin / executive can switch branches manually
    // This ONLY affects UI filtering — RLS is the real guard
    if (!canViewAllBranches) {
      console.warn('[BranchGuard] Non-admin attempted branch switch — blocked.');
      return;
    }
    if (branch) {
      localStorage.setItem('active_branch_id', branch.id);
      setActiveBranchState(branch);
      invalidateBranchCache();
      window.dispatchEvent(new Event('branch-changed'));
    }
  }, [canViewAllBranches]);

  const contextValue = useMemo(() => ({
    branches,
    userBranchId,
    activeBranch,
    setActiveBranch,
    isLoading,
    refreshBranches: fetchBranches,
    canViewAllBranches,
  }), [branches, userBranchId, activeBranch, setActiveBranch, isLoading, fetchBranches, canViewAllBranches]);

  return (
    <BranchContext.Provider value={contextValue}>
      {children}
    </BranchContext.Provider>
  );
};

export const useBranch = () => {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return context;
};
