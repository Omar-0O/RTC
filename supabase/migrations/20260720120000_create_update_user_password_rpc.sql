-- RPC function to update user password securely from admin panel
-- Replaces requirement for Edge Function deployment
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
  is_authorized BOOLEAN := FALSE;
BEGIN
  requester_id := auth.uid();
  IF requester_id IS NULL THEN
    RETURN json_build_object('error', 'Unauthorized: Not authenticated');
  END IF;

  SELECT COALESCE(array_agg(role::text), ARRAY[]::TEXT[])
  INTO requester_roles
  FROM public.user_roles
  WHERE user_id = requester_id;

  IF requester_roles && ARRAY['admin', 'executive', 'branch_admin', 'supervisor', 'head_hr', 'hr', 'head_quran', 'committee_leader']::TEXT[] THEN
    is_authorized := TRUE;
  END IF;

  IF NOT is_authorized THEN
    RETURN json_build_object('error', 'Unauthorized: Management access required');
  END IF;

  IF length(trim(new_password)) < 6 THEN
    RETURN json_build_object('error', 'Password must be at least 6 characters');
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(trim(new_password), gen_salt('bf'))
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

GRANT EXECUTE ON FUNCTION public.update_user_password(UUID, TEXT) TO authenticated;
