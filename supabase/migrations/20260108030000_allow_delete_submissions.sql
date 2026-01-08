-- Add DELETE policy for activity_submissions
-- Allow admin and head_hr to delete activity submissions

CREATE POLICY "Admins and Head HR can delete submissions" ON public.activity_submissions
  FOR DELETE USING (
    auth.uid() IN (
      SELECT user_id FROM public.user_roles 
      WHERE role IN ('admin', 'head_hr')
    )
  );
