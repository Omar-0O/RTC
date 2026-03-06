-- Drop the existing policy
DROP POLICY IF EXISTS "Admins supervisors and committee leaders can award badges" ON public.user_badges;

-- Create new policy that includes hr and head_hr
CREATE POLICY "Admins supervisors HRs and committee leaders can award badges"
  ON public.user_badges
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admins, supervisors, hr, head_hr can award to anyone
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'supervisor') OR
    public.has_role(auth.uid(), 'hr') OR
    public.has_role(auth.uid(), 'head_hr') OR
    
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