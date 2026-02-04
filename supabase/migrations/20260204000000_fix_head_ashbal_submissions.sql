-- Fix group_submissions RLS to include all head roles
DROP POLICY IF EXISTS "Privileged users can create group submissions" ON public.group_submissions;

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
      AND role IN (
        'committee_leader',
        'head_caravans',
        'head_events',
        'head_hr',
        'head_ethics',
        'head_production',
        'head_fourth_year',
        'head_marketing',
        'head_quran',
        'head_ashbal'
      )
    )
    AND
    -- User has a committee assigned
    public.get_user_committee_id(auth.uid()) IS NOT NULL
    AND
    -- Submission committee matches user's committee
    committee_id = public.get_user_committee_id(auth.uid())
  )
);

-- Fix activity_submissions RLS to include all head roles
DROP POLICY IF EXISTS "Privileged users can create submissions for others" ON public.activity_submissions;

CREATE POLICY "Privileged users can create submissions for others"
ON public.activity_submissions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN (
        'admin',
        'supervisor',
        'committee_leader',
        'head_caravans',
        'head_events',
        'head_hr',
        'head_ethics',
        'head_production',
        'head_fourth_year',
        'head_marketing',
        'head_quran',
        'head_ashbal'
    )
  )
);
