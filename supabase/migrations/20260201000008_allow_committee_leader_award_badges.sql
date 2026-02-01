-- Allow committee leaders to award badges to their committee members
-- This migration updates the RLS policy on user_badges to include committee_leader role

-- Drop existing policy
DROP POLICY IF EXISTS "Admins and supervisors can award badges" ON public.user_badges;

-- Create new policy that includes committee_leader
-- Committee leaders can only award badges to members in their own committee
CREATE POLICY "Admins supervisors and committee leaders can award badges" 
  ON public.user_badges
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    -- Admins and supervisors can award to anyone
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'supervisor') OR
    -- Committee leaders can award to members in their committee
    (
      public.has_role(auth.uid(), 'committee_leader') AND
      EXISTS (
        SELECT 1 FROM public.profiles leader
        JOIN public.profiles member ON member.committee_id = leader.committee_id
        WHERE leader.id = auth.uid() 
        AND member.id = user_id
      )
    )
  );
