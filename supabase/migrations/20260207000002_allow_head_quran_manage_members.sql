-- Allow Head of Quran to view and update profiles
-- This is necessary for the Members management page where they assign volunteers to committees.

-- 1. View Policy
CREATE POLICY "Head Quran can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'head_quran')
);

-- 2. Update Policy
CREATE POLICY "Head Quran can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'head_quran')
);
