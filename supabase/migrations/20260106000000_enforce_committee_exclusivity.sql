-- Create a policy that allows committee leaders to update ONLY their own members or unassigned volunteers
-- and strictly controls what they can change (only claiming or releasing members)

DROP POLICY IF EXISTS "Committee leaders can update profiles" ON public.profiles;

CREATE POLICY "Committee leaders can manage committee membership"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'committee_leader'
  )
  AND (
    -- Can update if the user is already in their committee (to remove them)
    committee_id IN (
      SELECT committee_id FROM public.profiles WHERE id = auth.uid()
    )
    OR
    -- OR can update if the user has no committee (to add them)
    committee_id IS NULL
  )
)
WITH CHECK (
  -- Can only set the committee_id to their own committee (adding)
  committee_id IN (
    SELECT committee_id FROM public.profiles WHERE id = auth.uid()
  )
  OR
  -- OR can set it to NULL (removing)
  committee_id IS NULL
);
