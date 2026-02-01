-- Update RLS policies for user_private_details to allow head_hr and hr to view passwords
DROP POLICY IF EXISTS "Admins can view private details" ON public.user_private_details;

CREATE POLICY "Privileged users can view private details" ON public.user_private_details
    FOR SELECT USING (
        auth.uid() IN (
             SELECT user_id FROM user_roles WHERE role IN ('admin', 'head_hr', 'hr')
        )
    );
