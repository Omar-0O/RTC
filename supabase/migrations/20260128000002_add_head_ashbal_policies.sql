-- Run this AFTER the enum value 'head_ashbal' has been successfully added.

-- Policy: Head Ashbal can view all profiles (needed to see the list)
CREATE POLICY "Head Ashbal can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'head_ashbal')
);

-- Policy: Head Ashbal can update profiles (to set is_ashbal = true or edit details)
CREATE POLICY "Head Ashbal can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'head_ashbal')
);

-- Policy: Head Ashbal can insert new profiles (add new volunteers)
CREATE POLICY "Head Ashbal can insert profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'head_ashbal')
);

-- Policy: Head Ashbal can delete Ashbal users
CREATE POLICY "Head Ashbal can delete ashbal profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'head_ashbal') 
  AND is_ashbal = true
);
