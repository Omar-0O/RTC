-- Fix RLS policies for badges table to allow supervisors to manage badges

-- Drop existing admin-only policy
DROP POLICY IF EXISTS "Admins can manage badges" ON public.badges;

-- Create new policy for admins AND supervisors
CREATE POLICY "Admins and supervisors can manage badges" 
  ON public.badges
  FOR ALL 
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'supervisor')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'supervisor')
  );

-- Also update user_badges policy to allow supervisors to award badges
DROP POLICY IF EXISTS "System can award badges" ON public.user_badges;

CREATE POLICY "Admins and supervisors can award badges" 
  ON public.user_badges
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'supervisor')
  );
