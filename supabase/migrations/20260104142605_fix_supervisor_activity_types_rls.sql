-- Add RLS policies for supervisors to manage activity types for their committees
-- Admin policies remain unchanged, we're only adding supervisor policies

-- Add policy to allow supervisors to insert activity types for their committees
CREATE POLICY "Supervisors can insert activity types for their committees" 
  ON public.activity_types
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'supervisor') AND (
      -- Allow if no committee is specified (general activities)
      committee_id IS NULL OR
      -- Allow if the supervisor is assigned to this committee
      committee_id = public.get_user_committee_id(auth.uid())
    )
  );

-- Add policy to allow supervisors to update activity types for their committees
CREATE POLICY "Supervisors can update activity types for their committees" 
  ON public.activity_types
  FOR UPDATE 
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'supervisor') AND (
      committee_id IS NULL OR
      committee_id = public.get_user_committee_id(auth.uid())
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'supervisor') AND (
      committee_id IS NULL OR
      committee_id = public.get_user_committee_id(auth.uid())
    )
  );

-- Add policy to allow supervisors to delete activity types for their committees
CREATE POLICY "Supervisors can delete activity types for their committees" 
  ON public.activity_types
  FOR DELETE 
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'supervisor') AND (
      committee_id IS NULL OR
      committee_id = public.get_user_committee_id(auth.uid())
    )
  );
