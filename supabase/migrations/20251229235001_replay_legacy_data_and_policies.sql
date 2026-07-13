-- Values added to enums in the preceding migration are now committed and may
-- be used by profile data updates and RLS policies.

UPDATE public.profiles
SET level = 'under_follow_up'
WHERE level::text IN ('bronze', 'newbie', 'silver', 'active');

UPDATE public.profiles
SET level = 'project_responsible'
WHERE level::text = 'gold';

UPDATE public.profiles
SET level = 'responsible'
WHERE level::text IN ('platinum', 'diamond');

ALTER TABLE public.profiles ALTER COLUMN level SET DEFAULT 'under_follow_up';

DROP POLICY IF EXISTS "HR and Head HR can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Head HR can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "HR and Head HR can view all submissions" ON public.activity_submissions;

CREATE POLICY "HR and Head HR can view all profiles" ON public.profiles
  FOR SELECT USING (
    public.has_role(auth.uid(), 'hr')
    OR public.has_role(auth.uid(), 'head_hr')
  );

CREATE POLICY "Head HR can update profiles" ON public.profiles
  FOR UPDATE USING (public.has_role(auth.uid(), 'head_hr'));

CREATE POLICY "HR and Head HR can view all submissions" ON public.activity_submissions
  FOR SELECT USING (
    public.has_role(auth.uid(), 'hr')
    OR public.has_role(auth.uid(), 'head_hr')
  );
