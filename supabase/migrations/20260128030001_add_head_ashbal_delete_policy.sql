DROP POLICY IF EXISTS "Head Ashbal can delete ashbal profiles" ON public.profiles;

CREATE POLICY "Head Ashbal can delete ashbal profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'head_ashbal')
  AND is_ashbal = true
);
