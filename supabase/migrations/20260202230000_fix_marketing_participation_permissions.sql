-- Fix collective participation permissions for head_marketing and committee_leader visibility

-- 1. Updates to activity_submissions policy
-- Allow head_marketing to insert submissions for others
DROP POLICY IF EXISTS "Privileged users can create submissions for others" ON public.activity_submissions;

CREATE POLICY "Privileged users can create submissions for others"
ON public.activity_submissions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'supervisor', 'committee_leader', 'head_caravans', 'head_events', 'head_hr', 'head_marketing')
  )
);

-- Ensure head_marketing can view all submissions
DROP POLICY IF EXISTS "head_marketing_view_submissions" ON public.activity_submissions;
CREATE POLICY "head_marketing_view_submissions"
ON public.activity_submissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'head_marketing'
  )
);

-- Ensure reviewers (e.g. committee_leader) can view submissions they approved/reviewed
-- This is critical for "Group Submissions" created for other committees or specialized activities
DROP POLICY IF EXISTS "Reviewers can view their reviewed submissions" ON public.activity_submissions;
CREATE POLICY "Reviewers can view their reviewed submissions"
ON public.activity_submissions
FOR SELECT
USING (
  reviewed_by = auth.uid()
);


-- 2. Updates to group_submissions policy
-- Allow head_marketing to create group submissions (globally, like head_hr)
DROP POLICY IF EXISTS "Privileged users can create group submissions" ON public.group_submissions;

CREATE POLICY "Privileged users can create group submissions"
ON public.group_submissions
FOR INSERT
WITH CHECK (
  -- Option 1: Global access (can create for any committee)
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'supervisor', 'head_hr', 'head_marketing', 'committee_leader')
  )
  OR
  -- Option 2: Committee restricted access
  (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('head_caravans', 'head_events')
    )
    AND
    public.get_user_committee_id(auth.uid()) IS NOT NULL
    AND
    committee_id = public.get_user_committee_id(auth.uid())
  )
);
