-- Fix RLS policies for activity_types table to allow admins to insert/update/delete

-- Drop existing policy
DROP POLICY IF EXISTS "Admins can manage activity types" ON public.activity_types;

-- Create separate policies for better clarity and debugging
CREATE POLICY "Admins can insert activity types" 
  ON public.activity_types
  FOR INSERT 
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update activity types" 
  ON public.activity_types
  FOR UPDATE 
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete activity types" 
  ON public.activity_types
  FOR DELETE 
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
