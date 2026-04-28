-- Step 2: Create helper functions AFTER enum values are committed
-- (Must run in a separate transaction from the ALTER TYPE above)

-- Helper function: can this user see all branches (admin or executive)?
CREATE OR REPLACE FUNCTION public.can_view_all_branches(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('admin', 'executive')
  );
$$;

-- Helper function: get the branch_id of a branch_admin user
CREATE OR REPLACE FUNCTION public.get_user_branch_id_safe(_user_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT branch_id FROM public.profiles WHERE id = _user_id;
$$;
