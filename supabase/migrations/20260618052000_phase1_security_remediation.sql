-- ============================================================================
-- PHASE 1 SECURITY REMEDIATION
-- - Remove reversible password storage.
-- - Restrict direct role writes to global admins or low-risk delegated branch roles.
-- - Harden delete_user_account with branch and target-role hierarchy checks.
-- ============================================================================

BEGIN;

-- Passwords must never be stored reversibly. Historical migrations added both a
-- profile column and a private details table; remove both for upgraded projects.
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS visible_password;

DROP TABLE IF EXISTS public.user_private_details CASCADE;

CREATE OR REPLACE FUNCTION public.is_global_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role::text IN ('admin', 'executive')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_delegated_role(target_role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT target_role::text IN ('volunteer', 'committee_leader', 'marketing_member');
$$;

CREATE OR REPLACE FUNCTION public.is_same_branch_target(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles target
    WHERE target.id = target_user_id
      AND target.branch_id = public.get_my_branch_id()
      AND target.branch_id IS NOT NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_branch_role_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role::text IN ('branch_admin', 'head_hr', 'supervisor')
  );
$$;

DROP POLICY IF EXISTS "roles_modify" ON public.user_roles;
DROP POLICY IF EXISTS "roles_modify_admin" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin and HR can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin and HR can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin and HR can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin and HR can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "roles_modify_global_admin" ON public.user_roles;
DROP POLICY IF EXISTS "roles_insert_branch_delegated" ON public.user_roles;
DROP POLICY IF EXISTS "roles_update_branch_delegated" ON public.user_roles;
DROP POLICY IF EXISTS "roles_delete_branch_delegated" ON public.user_roles;

CREATE POLICY "roles_modify_global_admin"
ON public.user_roles
FOR ALL TO authenticated
USING (public.is_global_admin())
WITH CHECK (public.is_global_admin());

CREATE POLICY "roles_insert_branch_delegated"
ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (
  public.is_branch_role_manager()
  AND public.is_same_branch_target(user_id)
  AND public.is_delegated_role(role)
);

CREATE POLICY "roles_update_branch_delegated"
ON public.user_roles
FOR UPDATE TO authenticated
USING (
  public.is_branch_role_manager()
  AND public.is_same_branch_target(user_id)
  AND public.is_delegated_role(role)
)
WITH CHECK (
  public.is_branch_role_manager()
  AND public.is_same_branch_target(user_id)
  AND public.is_delegated_role(role)
);

CREATE POLICY "roles_delete_branch_delegated"
ON public.user_roles
FOR DELETE TO authenticated
USING (
  public.is_branch_role_manager()
  AND public.is_same_branch_target(user_id)
  AND public.is_delegated_role(role)
);

CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id UUID;
  requester_roles TEXT[];
  target_roles TEXT[];
  requester_branch UUID;
  target_branch UUID;
  target_is_ashbal BOOLEAN;
  target_is_protected BOOLEAN;
  is_authorized BOOLEAN := FALSE;
BEGIN
  requester_id := auth.uid();

  IF requester_id IS NULL THEN
    RETURN json_build_object('error', 'Unauthorized: Not authenticated');
  END IF;

  IF requester_id = target_user_id THEN
    RETURN json_build_object('error', 'Cannot delete your own account');
  END IF;

  SELECT COALESCE(array_agg(role::text), ARRAY[]::TEXT[])
  INTO requester_roles
  FROM public.user_roles
  WHERE user_id = requester_id;

  SELECT COALESCE(array_agg(role::text), ARRAY[]::TEXT[])
  INTO target_roles
  FROM public.user_roles
  WHERE user_id = target_user_id;

  SELECT branch_id INTO requester_branch
  FROM public.profiles
  WHERE id = requester_id;

  SELECT branch_id, COALESCE(is_ashbal, FALSE)
  INTO target_branch, target_is_ashbal
  FROM public.profiles
  WHERE id = target_user_id;

  IF target_branch IS NULL THEN
    RETURN json_build_object('error', 'Target user not found');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM unnest(target_roles) AS role_name
    WHERE role_name NOT IN ('volunteer', 'committee_leader', 'marketing_member')
  )
  INTO target_is_protected;

  IF requester_roles && ARRAY['admin', 'executive']::TEXT[] THEN
    is_authorized := TRUE;
  ELSIF requester_roles && ARRAY['head_hr', 'supervisor', 'branch_admin']::TEXT[]
    AND requester_branch IS NOT NULL
    AND requester_branch = target_branch
    AND NOT target_is_protected THEN
    is_authorized := TRUE;
  ELSIF 'head_ashbal' = ANY(requester_roles)
    AND requester_branch IS NOT NULL
    AND requester_branch = target_branch
    AND target_is_ashbal = TRUE
    AND NOT target_is_protected THEN
    is_authorized := TRUE;
  END IF;

  IF NOT is_authorized THEN
    RETURN json_build_object('error', 'Unauthorized: insufficient permissions for target user');
  END IF;

  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  DELETE FROM public.profiles WHERE id = target_user_id;

  RETURN json_build_object('success', TRUE, 'message', 'User deleted successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('error', 'Database error: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_account(UUID) TO authenticated;

COMMIT;
