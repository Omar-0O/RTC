-- Fix RLS policies for committees table to allow admins to insert/update/delete

-- Drop existing policy
DROP POLICY IF EXISTS "Admins can manage committees" ON public.committees;

-- Create separate policies for better clarity and debugging
CREATE POLICY "Admins can insert committees" 
  ON public.committees
  FOR INSERT 
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update committees" 
  ON public.committees
  FOR UPDATE 
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete committees" 
  ON public.committees
  FOR DELETE 
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
