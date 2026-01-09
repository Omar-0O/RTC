-- Fix group_submissions RLS policy to allow all privileged committee leaders
-- Run this SQL in Supabase Dashboard > SQL Editor

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Committee leaders can create group submissions" ON public.group_submissions;

-- Create new policy that allows any user with a leadership role who has a committee_id
CREATE POLICY "Privileged committee leaders can create group submissions"
ON public.group_submissions
FOR INSERT
WITH CHECK (
  -- User must have a committee assigned (be a committee leader)
  public.get_user_committee_id(auth.uid()) IS NOT NULL
  AND
  -- User must have a privileged role
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'supervisor', 'committee_leader', 'head_caravans', 'head_events', 'head_hr')
  )
  AND
  -- The submission's committee must match the user's committee
  -- (unless they're admin or supervisor who can create for any committee)
  (
    committee_id = public.get_user_committee_id(auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'supervisor')
    )
  )
);
