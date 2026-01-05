-- Allow supervisors and admins to create group submissions
CREATE POLICY "Supervisors and admins can create group submissions" ON public.group_submissions
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'supervisor') OR 
    public.has_role(auth.uid(), 'admin')
  );

-- Allow supervisors and admins to create activity submissions for any committee
CREATE POLICY "Supervisors and admins can create submissions for any committee" ON public.activity_submissions
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'supervisor') OR 
    public.has_role(auth.uid(), 'admin')
  );
