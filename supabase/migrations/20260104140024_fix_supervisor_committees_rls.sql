-- Fix RLS policies for committees table to allow supervisors to manage committees

-- Drop existing admin-only policies
DROP POLICY IF EXISTS "Admins can insert committees" ON public.committees;
DROP POLICY IF EXISTS "Admins can update committees" ON public.committees;
DROP POLICY IF EXISTS "Admins can delete committees" ON public.committees;

-- Create new policies for admins AND supervisors
CREATE POLICY "Admins and supervisors can insert committees" 
  ON public.committees
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'supervisor')
  );

CREATE POLICY "Admins and supervisors can update committees" 
  ON public.committees
  FOR UPDATE 
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'supervisor')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'supervisor')
  );

CREATE POLICY "Admins and supervisors can delete committees" 
  ON public.committees
  FOR DELETE 
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'supervisor')
  );
