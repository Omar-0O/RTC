-- Migration: Allow course organizers and marketers to delete/leave their own records

-- 1. Update course_organizers delete policy
DROP POLICY IF EXISTS "course_organizers_self_delete" ON public.course_organizers;
CREATE POLICY "course_organizers_self_delete" ON public.course_organizers
    FOR DELETE TO authenticated
    USING (volunteer_id = auth.uid());

-- 2. Update course_marketers delete policy to include self-deletion
DROP POLICY IF EXISTS "course_marketers_delete" ON public.course_marketers;
CREATE POLICY "course_marketers_delete" ON public.course_marketers 
    FOR DELETE TO authenticated 
    USING (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'supervisor')
        OR public.has_role(auth.uid(), 'committee_leader')
        OR public.has_role(auth.uid(), 'head_marketing')
        OR public.has_role(auth.uid(), 'head_hr')
        OR volunteer_id = auth.uid()
    );
