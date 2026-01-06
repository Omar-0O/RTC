-- Allow committee leaders to view activity submissions of users in their committee
DROP POLICY IF EXISTS "Committee leaders can view submissions of their committee members" ON public.activity_submissions;

CREATE POLICY "Committee leaders can view submissions of their committee members"
ON public.activity_submissions
FOR SELECT
TO authenticated
USING (
  -- User must be in the same committee as the submission
  (SELECT committee_id FROM public.profiles WHERE id = auth.uid()) = committee_id
  AND
  -- User must have a leader-like role
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('committee_leader', 'admin', 'head_hr', 'supervisor')
  )
);
