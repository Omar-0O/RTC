-- Harden update_user_password RPC with branch isolation and role-hierarchy enforcement.
-- Prevents privilege escalation where lower-privileged managers could overwrite passwords
-- of global admins, executives, peers, or users outside their branch.

BEGIN;

CREATE OR REPLACE FUNCTION public.update_user_password(
  target_user_id UUID,
  new_password TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
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
    RETURN json_build_object('error', 'Unauthorized: Use account settings to update your own password');
  END IF;

  IF new_password IS NULL OR length(trim(new_password)) < 6 THEN
    RETURN json_build_object('error', 'Password must be at least 6 characters');
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

  SELECT EXISTS (
    SELECT 1
    FROM unnest(target_roles) AS role_name
    WHERE role_name NOT IN ('volunteer', 'committee_leader', 'marketing_member')
  )
  INTO target_is_protected;

  IF requester_roles && ARRAY['admin', 'executive']::TEXT[] THEN
    is_authorized := TRUE;
  ELSIF requester_roles && ARRAY['head_hr', 'hr', 'supervisor', 'branch_admin']::TEXT[]
    AND requester_branch IS NOT NULL
    AND requester_branch = target_branch
    AND NOT target_is_protected THEN
    is_authorized := TRUE;
  ELSIF 'head_ashbal' = ANY(requester_roles)
    AND requester_branch IS NOT NULL
    AND requester_branch = target_branch
    AND target_is_ashbal = TRUE
    AND NOT target_is_protected
    AND NOT ('committee_leader' = ANY(target_roles)) THEN
    is_authorized := TRUE;
  ELSIF requester_roles && ARRAY['head_quran', 'committee_leader']::TEXT[]
    AND requester_branch IS NOT NULL
    AND requester_branch = target_branch
    AND NOT target_is_protected
    AND NOT ('committee_leader' = ANY(target_roles)) THEN
    is_authorized := TRUE;
  END IF;

  IF NOT is_authorized THEN
    RETURN json_build_object('error', 'Unauthorized: insufficient permissions for target user');
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(trim(new_password), gen_salt('bf')),
      updated_at = now()
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'User not found in auth system');
  END IF;

  RETURN json_build_object(
    'success', TRUE,
    'message', 'Password updated successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'error', 'Database error: ' || SQLERRM
    );
END;
$$;

REVOKE ALL ON FUNCTION public.update_user_password(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_user_password(UUID, TEXT) TO authenticated;

COMMIT;
