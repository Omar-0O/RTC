-- Allow head_hr to create, edit, move, and delete activity structure nodes in their own branch.

CREATE OR REPLACE FUNCTION public.can_manage_activity_structure(_branch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = (SELECT auth.uid()) AND role::text = 'admin'
  )
  OR (
    _branch_id IS NOT NULL
    AND _branch_id = (SELECT branch_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role::text IN ('branch_admin', 'supervisor', 'head_hr')
    )
  );
$$;
