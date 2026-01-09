-- Fix group_submissions RLS policy to allow all privileged committee leaders
-- This fixes the issue where users with roles like head_hr, head_events, etc.
-- who are committee leaders cannot create group submissions

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Committee leaders can create group submissions" ON public.group_submissions;

-- Create new policy that allows:
-- 1. Admin/Supervisor can create for ANY committee (no committee_id required)
-- 2. Other privileged users (committee_leader, head_caravans, head_events, head_hr) 
--    must have a committee assigned and can only create for their committee
CREATE POLICY "Privileged users can create group submissions"
ON public.group_submissions
FOR INSERT
WITH CHECK (
  -- Option 1: User is admin or supervisor (can create for any committee)
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'supervisor')
  )
  OR
  -- Option 2: User has other privileged role and committee matches
  (
    -- User has a privileged role
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('committee_leader', 'head_caravans', 'head_events', 'head_hr')
    )
    AND
    -- User has a committee assigned
    public.get_user_committee_id(auth.uid()) IS NOT NULL
    AND
    -- Submission committee matches user's committee
    committee_id = public.get_user_committee_id(auth.uid())
  )
);
