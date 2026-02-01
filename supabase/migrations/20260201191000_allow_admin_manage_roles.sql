-- Allow admin and head_hr to manage user roles

-- Drop existing policies for managing roles if any
DROP POLICY IF EXISTS "Admin can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin and HR can manage roles" ON public.user_roles;

-- Policy for INSERT
CREATE POLICY "Admin and HR can insert roles" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role IN ('admin', 'head_hr', 'supervisor')
    )
);

-- Policy for UPDATE
CREATE POLICY "Admin and HR can update roles" ON public.user_roles
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role IN ('admin', 'head_hr', 'supervisor')
    )
);

-- Policy for DELETE
CREATE POLICY "Admin and HR can delete roles" ON public.user_roles
FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role IN ('admin', 'head_hr', 'supervisor')
    )
);
