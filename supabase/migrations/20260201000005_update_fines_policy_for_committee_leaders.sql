-- Allow committee_leader to view and create fines
-- This is necessary because the default policies only allowed admin/hr/supervisor

-- 1. Update SELECT policy
DROP POLICY IF EXISTS "Privileged users can view all fines" ON public.volunteer_fines;
CREATE POLICY "Privileged users can view all fines" ON public.volunteer_fines
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'head_hr', 'hr', 'supervisor', 'committee_leader')
        )
    );

-- 2. Update INSERT policy
DROP POLICY IF EXISTS "Privileged users can create fines" ON public.volunteer_fines;
CREATE POLICY "Privileged users can create fines" ON public.volunteer_fines
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'head_hr', 'hr', 'supervisor', 'committee_leader')
        )
    );
