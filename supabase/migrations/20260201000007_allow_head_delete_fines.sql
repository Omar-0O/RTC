-- Allow privileged users (including committee leaders) to delete fines

DROP POLICY IF EXISTS "Privileged users can delete fines" ON public.volunteer_fines;
CREATE POLICY "Privileged users can delete fines" ON public.volunteer_fines
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'head_hr', 'hr', 'supervisor', 'committee_leader')
        )
    );
