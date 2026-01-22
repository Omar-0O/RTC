-- Allow privileged users (including head_ethics) to insert activity submissions for others
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
        'head_fourth_year'
    )
  )
);
