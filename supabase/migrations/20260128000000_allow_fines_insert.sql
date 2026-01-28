-- Allow Admins, HR, and Heads to insert activity submissions (used for manual fines)
CREATE POLICY "Authorized roles can insert activity submissions"
ON public.activity_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'hr') OR
  public.has_role(auth.uid(), 'head_hr') OR
  public.has_role(auth.uid(), 'head_caravans') OR
  public.has_role(auth.uid(), 'head_production') OR
  public.has_role(auth.uid(), 'head_fourth_year') OR
  public.has_role(auth.uid(), 'head_events') OR
  public.has_role(auth.uid(), 'head_ethics') OR
  public.has_role(auth.uid(), 'head_quran')
);
