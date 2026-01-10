-- Fix group_submissions RLS policy to allow Head HR to create group submissions for ANY committee
-- This moves 'head_hr' from the restricted committee-check group to the global access group

DROP POLICY IF EXISTS "Privileged users can create group submissions" ON public.group_submissions;

CREATE POLICY "Privileged users can create group submissions"
ON public.group_submissions
FOR INSERT
WITH CHECK (
  -- Option 1: User is admin, supervisor, OR head_hr (can create for any committee)
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'supervisor', 'head_hr')
  )
  OR
  -- Option 2: User has other privileged role and committee matches
  (
    -- User has a privileged role
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('committee_leader', 'head_caravans', 'head_events')
    )
    AND
    -- User has a committee assigned
    public.get_user_committee_id(auth.uid()) IS NOT NULL
    AND
    -- Submission committee matches user's committee
    committee_id = public.get_user_committee_id(auth.uid())
  )
);
