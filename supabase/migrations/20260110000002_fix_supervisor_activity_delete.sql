-- Fix: Allow supervisors to delete any activity type
-- This drops the restrictive policy and creates a new one that allows supervisors to delete all activities

-- Drop the old restrictive delete policy for supervisors
DROP POLICY IF EXISTS "Supervisors can delete activity types for their committees" ON public.activity_types;

-- Create a new policy that allows supervisors to delete ANY activity type
CREATE POLICY "Supervisors can delete any activity types" 
  ON public.activity_types
  FOR DELETE 
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'supervisor')
  );

-- Also ensure submissions are cascade-deleted when activity is deleted
-- (This should already exist but let's make sure)
ALTER TABLE public.activity_submissions 
  DROP CONSTRAINT IF EXISTS activity_submissions_activity_type_id_fkey;
  
ALTER TABLE public.activity_submissions 
  ADD CONSTRAINT activity_submissions_activity_type_id_fkey 
  FOREIGN KEY (activity_type_id) REFERENCES public.activity_types(id) ON DELETE CASCADE;

ALTER TABLE public.group_submissions
  DROP CONSTRAINT IF EXISTS group_submissions_activity_type_id_fkey;

ALTER TABLE public.group_submissions
  ADD CONSTRAINT group_submissions_activity_type_id_fkey
  FOREIGN KEY (activity_type_id) REFERENCES public.activity_types(id) ON DELETE CASCADE;
