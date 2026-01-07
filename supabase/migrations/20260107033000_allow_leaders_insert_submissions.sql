-- Allow privileged users to insert activity submissions for others (e.g. Caravan leader adding volunteers)
CREATE POLICY "Privileged users can create submissions for others"
ON public.activity_submissions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'supervisor', 'committee_leader', 'head_caravans', 'head_events', 'head_hr')
  )
);

-- Allow privileged users to create activity types if needed (e.g. auto-creating 'Caravan' type)
CREATE POLICY "Privileged users can create activity types"
ON public.activity_types
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'supervisor', 'committee_leader', 'head_caravans', 'head_events', 'head_hr')
  )
);
