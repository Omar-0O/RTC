-- Policies for HR and Head HR

-- 1. Profiles Table
-- HR and Head HR can view all profiles
CREATE POLICY "HR and Head HR can view all profiles" ON public.profiles
  FOR SELECT USING (
    public.has_role(auth.uid(), 'hr') OR 
    public.has_role(auth.uid(), 'head_hr')
  );

-- Head HR can update profiles (specifically level, but RLS is row-level)
CREATE POLICY "Head HR can update profiles" ON public.profiles
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'head_hr')
  );

-- 2. Activity Submissions Table
-- HR and Head HR can view all submissions (like admins/supervisors)
CREATE POLICY "HR and Head HR can view all submissions" ON public.activity_submissions
  FOR SELECT USING (
    public.has_role(auth.uid(), 'hr') OR 
    public.has_role(auth.uid(), 'head_hr')
  );
