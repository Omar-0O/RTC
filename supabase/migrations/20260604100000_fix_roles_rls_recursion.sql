-- ============================================================================
-- FIX: Self-referential RLS recursion on user_roles table
-- ============================================================================
-- Problem: The policy "roles_modify" added by 20260604000000 queries user_roles
-- from within user_roles' own RLS policy, causing infinite recursion in 
-- PostgreSQL. This effectively denies all role modifications and may cause
-- role reads to fail in some configurations.
--
-- Solution: Create a SECURITY DEFINER function that bypasses RLS to check
-- if the calling user is a branch_admin, then use it in the policy.
-- ============================================================================

-- 1. Create helper function to check if current user is a branch_admin
-- SECURITY DEFINER runs as the function owner (bypasses RLS on user_roles)
CREATE OR REPLACE FUNCTION public.is_branch_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role::text = 'branch_admin'
  );
$$;

-- 2. Fix the roles_modify policy to use the helper function
DROP POLICY IF EXISTS "roles_modify" ON public.user_roles;
CREATE POLICY "roles_modify" ON public.user_roles FOR ALL TO authenticated
  USING (
    public.is_admin_or_exec() OR (
      public.is_branch_admin()
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE public.profiles.id = public.user_roles.user_id 
          AND public.profiles.branch_id = public.get_my_branch_id()
      )
    )
  );

-- 3. Verify roles_select policy still exists (should be USING (true))
-- This is a safety net — do not drop/recreate if it already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_roles' AND policyname = 'roles_select'
  ) THEN
    EXECUTE 'CREATE POLICY "roles_select" ON public.user_roles FOR SELECT TO authenticated USING (true)';
  END IF;
END;
$$;

-- 4. Also fix the user_features_modify policy which has the same recursion issue
DROP POLICY IF EXISTS "user_features_modify" ON public.user_features;
CREATE POLICY "user_features_modify" ON public.user_features FOR ALL TO authenticated
  USING (
    public.is_admin_or_exec() OR (
      public.is_branch_admin()
      AND branch_id = public.get_my_branch_id()
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE public.profiles.id = public.user_features.user_id 
          AND public.profiles.branch_id = public.get_my_branch_id()
      )
    )
  );
