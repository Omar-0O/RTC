-- Allow HR to delete activity submissions (in addition to Admin and Head HR)

DROP POLICY IF EXISTS "Admins and Head HR can delete submissions" ON public.activity_submissions;

CREATE POLICY "Admins, Head HR, and HR can delete submissions" ON public.activity_submissions
  FOR DELETE USING (
    auth.uid() IN (
      SELECT user_id FROM public.user_roles 
      WHERE role IN ('admin', 'head_hr', 'hr')
    )
  );
