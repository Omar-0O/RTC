/**
 * Branch Guard — centralized multi-tenant isolation layer.
 *
 * ALL data access MUST flow through these utilities.
 * The branch_id is NEVER trusted from the frontend.
 * RLS is the primary enforcement; this module provides the application-level API.
 *
 * Architecture:
 *   Component → Hook → Service (uses branchGuard) → Supabase (RLS enforced)
 */
import { supabase } from '@/integrations/supabase/client';

// ─── Types ──────────────────────────────────────────────────────────

export interface BranchScope {
  /** The authenticated user's branch_id (from DB, NOT frontend) */
  userBranchId: string | null;
  /** Whether the user is admin/executive (can view all) */
  isAdmin: boolean;
  /** For admin: the currently selected branch for filtering (UI only) */
  viewingBranchId?: string | null;
}

// ─── Cache ──────────────────────────────────────────────────────────

let _cachedScope: BranchScope | null = null;
let _cacheUserId: string | null = null;

/**
 * Get the current user's branch scope from the DB.
 * Cached per user session; call `invalidateBranchCache()` on auth change.
 */
export async function getBranchScope(): Promise<BranchScope> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { userBranchId: null, isAdmin: false };

  // Return cached if same user
  if (_cachedScope && _cacheUserId === user.id) return _cachedScope;

  const [profileRes, rolesRes] = await Promise.all([
    supabase.from('profiles').select('branch_id').eq('id', user.id).single(),
    supabase.from('user_roles').select('role').eq('user_id', user.id),
  ]);

  const roles = (rolesRes.data || []).map((r: any) => r.role as string);
  const isAdmin = roles.includes('admin') || roles.includes('executive');

  _cachedScope = {
    userBranchId: profileRes.data?.branch_id || null,
    isAdmin,
  };
  _cacheUserId = user.id;
  return _cachedScope;
}

/** Clear the cached scope (call on sign-out or branch change). */
export function invalidateBranchCache(): void {
  _cachedScope = null;
  _cacheUserId = null;
}

// ─── Query Helpers ──────────────────────────────────────────────────

/**
 * Create a scoped SELECT query. RLS is the primary guard,
 * but for admin users viewing a specific branch, we add a client-side filter.
 *
 * Usage:
 *   const { query } = await scopedQuery('profiles');
 *   const { data } = await query.select('*').order('full_name');
 */
export async function scopedQuery(
  table: string,
  adminBranchFilter?: string | null
) {
  const scope = await getBranchScope();
  let query = (supabase as any).from(table).select as any;

  // For admin: optionally filter to a specific branch for the UI
  // RLS already allows them to see everything, this is just a convenience filter
  if (scope.isAdmin && adminBranchFilter) {
    return {
      query: (supabase as any).from(table),
      scope,
      branchFilter: adminBranchFilter,
    };
  }

  // For non-admin: RLS handles it, no client-side filter needed
  return {
    query: (supabase as any).from(table),
    scope,
    branchFilter: null,
  };
}

/**
 * Prepare data for INSERT by auto-injecting branch_id.
 * Strips any client-supplied branch_id for non-admin users.
 *
 * Note: The DB trigger `auto_set_branch_id` is the ultimate guard,
 * but we also enforce it here for defense-in-depth.
 */
export async function scopedInsert<T extends Record<string, any>>(
  table: string,
  data: T | T[]
): Promise<{ data: T | T[]; scope: BranchScope }> {
  const scope = await getBranchScope();
  const branchId = scope.userBranchId;

  const inject = (row: T): T => {
    const cleaned = { ...row };
    if (!scope.isAdmin) {
      // Non-admin: ALWAYS override branch_id with user's branch
      cleaned.branch_id = branchId;
    } else if (!cleaned.branch_id) {
      // Admin: use their branch if not explicitly set
      cleaned.branch_id = branchId;
    }
    return cleaned;
  };

  if (Array.isArray(data)) {
    return { data: data.map(inject), scope };
  }
  return { data: inject(data), scope };
}

/**
 * Prepare data for UPDATE by stripping branch_id from non-admin users.
 * Prevents any attempt to move a record to another branch.
 */
export async function scopedUpdate<T extends Record<string, any>>(
  table: string,
  data: T
): Promise<{ data: T; scope: BranchScope }> {
  const scope = await getBranchScope();
  const cleaned = { ...data };

  if (!scope.isAdmin) {
    // Non-admin: NEVER allow changing branch_id
    delete (cleaned as any).branch_id;
  }

  return { data: cleaned, scope };
}

/**
 * Apply branch filter to an existing query builder.
 * For admin: filter by the viewing branch (UI convenience).
 * For non-admin: RLS handles it; this is a no-op.
 */
export function applyBranchFilter<Q>(
  query: Q,
  scope: BranchScope,
  viewingBranchId?: string | null
): Q {
  if (scope.isAdmin && viewingBranchId) {
    return (query as any).eq('branch_id', viewingBranchId);
  }
  // RLS enforces for non-admin — no client filter needed
  return query;
}
