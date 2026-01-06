-- Allow supervisors to update profiles
DROP POLICY IF EXISTS "Supervisors can update profiles" ON public.profiles;

CREATE POLICY "Supervisors can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'supervisor'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'supervisor'
  )
);
