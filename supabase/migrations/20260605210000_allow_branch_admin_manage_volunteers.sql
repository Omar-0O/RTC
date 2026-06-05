-- ============================================================================
-- ALLOW BRANCH ADMIN TO MANAGE VOLUNTEERS
-- Update profiles and user_roles RLS policies, and update delete_user_account RPC.
-- ============================================================================

-- 1. Create a helper function that checks if user has any branch-management role
-- SECURITY DEFINER bypasses RLS to avoid infinite recursion on user_roles
CREATE OR REPLACE FUNCTION public.is_branch_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
      AND role::text IN ('branch_admin', 'head_hr', 'hr', 'supervisor')
  );
$$;

-- 2. Update profiles_update_admin RLS policy
-- Uses SECURITY DEFINER helper to avoid recursion
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;

CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_exec()
    OR (
      public.is_branch_manager()
      AND branch_id = public.get_my_branch_id()
    )
  );

-- 3. Update roles_modify RLS policy
-- Uses SECURITY DEFINER helper to avoid infinite recursion on user_roles
DROP POLICY IF EXISTS "roles_modify" ON public.user_roles;

CREATE POLICY "roles_modify" ON public.user_roles FOR ALL TO authenticated
  USING (
    public.is_admin_or_exec()
    OR (
      public.is_branch_manager()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = user_id AND p.branch_id = public.get_my_branch_id()
      )
      AND role::text NOT IN ('admin', 'executive')
    )
  );

-- 4. Update delete_user_account RPC function
CREATE OR REPLACE FUNCTION public.delete_user_account(
  target_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  requester_id UUID;
  requester_roles TEXT[];
  is_authorized BOOLEAN := FALSE;
  target_is_ashbal BOOLEAN;
  target_branch UUID;
  requester_branch UUID;
BEGIN
  -- Get the current user ID from the auth context
  requester_id := auth.uid();
  
  -- Check if user is authenticated
  IF requester_id IS NULL THEN
    RETURN json_build_object('error', 'Unauthorized: Not authenticated');
  END IF;
  
  -- Prevent self-deletion
  IF requester_id = target_user_id THEN
    RETURN json_build_object('error', 'Cannot delete your own account');
  END IF;
  
  -- Get requester's roles
  SELECT ARRAY_AGG(role) INTO requester_roles
  FROM public.user_roles
  WHERE user_id = requester_id;
  
  -- Check if target is ashbal
  SELECT is_ashbal INTO target_is_ashbal
  FROM public.profiles
  WHERE id = target_user_id;

  -- Get branches
  SELECT branch_id INTO target_branch FROM public.profiles WHERE id = target_user_id;
  SELECT branch_id INTO requester_branch FROM public.profiles WHERE id = requester_id;

  -- Authorization Logic
  -- 1. Admin or Head HR can delete anyone
  IF 'admin' = ANY(requester_roles) OR 'head_hr' = ANY(requester_roles) THEN
    is_authorized := TRUE;
  -- 2. Head Ashbal can delete ONLY Ashbals
  ELSIF 'head_ashbal' = ANY(requester_roles) AND target_is_ashbal = TRUE THEN
    is_authorized := TRUE;
  -- 3. Branch Admin can delete anyone in the same branch
  ELSIF 'branch_admin' = ANY(requester_roles) AND target_branch = requester_branch THEN
    is_authorized := TRUE;
  END IF;
  
  IF NOT is_authorized THEN
    RETURN json_build_object(
      'error', 
      'Unauthorized: Insufficient permissions to delete this user'
    );
  END IF;
  
  -- Delete the user's role entries
  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  
  -- Delete the user's profile
  DELETE FROM public.profiles WHERE id = target_user_id;
  
  -- Return success
  RETURN json_build_object(
    'success', TRUE,
    'message', 'User deleted successfully'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'error', 
      'Database error: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
