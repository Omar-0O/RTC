-- Enable RLS on profiles if not already enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that might be conflicting or insufficient
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Head HR can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "HR and Head HR can view all profiles" ON public.profiles;

-- Create comprehensive policies

-- 1. View Policy
-- Admins, Head HR, HR, and Supervisors can view all profiles
-- Volunteers can view their own profile (covered by "Profiles are viewable by authenticated users" usually, but let's be explicit)
CREATE POLICY "Privileged users can view all profiles" ON public.profiles
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'head_hr') OR
    public.has_role(auth.uid(), 'hr') OR
    public.has_role(auth.uid(), 'supervisor')
  );

-- 2. Update Policy
-- Admins and Head HR can update any profile
CREATE POLICY "Admins and Head HR can update profiles" ON public.profiles
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'head_hr')
  );
