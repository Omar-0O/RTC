-- Add ashbal_status to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS ashbal_status TEXT DEFAULT 'active' CHECK (ashbal_status IN ('active', 'previous'));

-- Backfill existing ashbals
-- We'll set everyone valid as 'active' initially
UPDATE public.profiles
SET ashbal_status = 'active'
WHERE is_ashbal = true;

-- Update delete_user_account to allow head_ashbal to delete ashbals
CREATE OR REPLACE FUNCTION public.delete_user_account(
  target_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  requester_id UUID;
  requester_roles TEXT[];
  is_authorized BOOLEAN := FALSE;
  target_is_ashbal BOOLEAN;
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

  -- Authorization Logic
  -- 1. Admin or Head HR can delete anyone
  IF 'admin' = ANY(requester_roles) OR 'head_hr' = ANY(requester_roles) THEN
    is_authorized := TRUE;
  -- 2. Head Ashbal can delete ONLY Ashbals
  ELSIF 'head_ashbal' = ANY(requester_roles) AND target_is_ashbal = TRUE THEN
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

-- RPC to renew Ashbal target (Archive current active ashbals)
CREATE OR REPLACE FUNCTION public.renew_ashbal_target()
RETURNS JSON AS $$
DECLARE
  requester_roles TEXT[];
  updated_count INTEGER;
BEGIN
  -- Check permissions (only head_ashbal or admin)
  SELECT ARRAY_AGG(role) INTO requester_roles
  FROM public.user_roles
  WHERE user_id = auth.uid();

  IF NOT ('head_ashbal' = ANY(requester_roles) OR 'admin' = ANY(requester_roles)) THEN
     RETURN json_build_object('error', 'Unauthorized');
  END IF;

  -- Update all 'active' ashbals to 'previous'
  WITH rows AS (
    UPDATE public.profiles
    SET ashbal_status = 'previous'
    WHERE is_ashbal = true AND ashbal_status = 'active'
    RETURNING 1
  )
  SELECT count(*) INTO updated_count FROM rows;

  RETURN json_build_object(
    'success', TRUE, 
    'message', 'Target renewed successfully',
    'count', updated_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
