-- Migration: Allow branch members and HR to manage course beneficiaries and attendance
-- Reason: Ensure users with HR role and branch volunteers can manage beneficiaries and attendance
-- for courses belonging to their branch.

DROP POLICY IF EXISTS "Manage course beneficiaries for heads" ON public.course_beneficiaries;
CREATE POLICY "Manage course beneficiaries for heads" ON public.course_beneficiaries
    FOR ALL TO authenticated
    USING (
        is_admin_or_exec()
        OR auth.uid() IN (
            SELECT user_id FROM public.user_roles 
            WHERE role IN (
                'admin', 'executive', 'branch_admin', 'supervisor',
                'committee_leader', 'head_production', 'head_fourth_year',
                'head_events', 'head_caravans', 'head_ethics', 'head_quran',
                'head_marketing', 'head_ashbal', 'head_hr', 'hr'
            )
        )
        OR EXISTS (
            SELECT 1 FROM public.courses c
            WHERE c.id = course_beneficiaries.course_id
            AND (c.branch_id = public.get_my_branch_id() OR c.created_by = auth.uid())
        )
    )
    WITH CHECK (
        is_admin_or_exec()
        OR auth.uid() IN (
            SELECT user_id FROM public.user_roles 
            WHERE role IN (
                'admin', 'executive', 'branch_admin', 'supervisor',
                'committee_leader', 'head_production', 'head_fourth_year',
                'head_events', 'head_caravans', 'head_ethics', 'head_quran',
                'head_marketing', 'head_ashbal', 'head_hr', 'hr'
            )
        )
        OR EXISTS (
            SELECT 1 FROM public.courses c
            WHERE c.id = course_beneficiaries.course_id
            AND (c.branch_id = public.get_my_branch_id() OR c.created_by = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Manage course attendance for heads" ON public.course_attendance;
CREATE POLICY "Manage course attendance for heads" ON public.course_attendance
    FOR ALL TO authenticated
    USING (
        is_admin_or_exec()
        OR auth.uid() IN (
            SELECT user_id FROM public.user_roles 
            WHERE role IN (
                'admin', 'executive', 'branch_admin', 'supervisor',
                'committee_leader', 'head_production', 'head_fourth_year',
                'head_events', 'head_caravans', 'head_ethics', 'head_quran',
                'head_marketing', 'head_ashbal', 'head_hr', 'hr'
            )
        )
        OR EXISTS (
            SELECT 1 FROM public.course_lectures cl
            JOIN public.courses c ON c.id = cl.course_id
            WHERE cl.id = course_attendance.lecture_id
            AND (c.branch_id = public.get_my_branch_id() OR c.created_by = auth.uid())
        )
    )
    WITH CHECK (
        is_admin_or_exec()
        OR auth.uid() IN (
            SELECT user_id FROM public.user_roles 
            WHERE role IN (
                'admin', 'executive', 'branch_admin', 'supervisor',
                'committee_leader', 'head_production', 'head_fourth_year',
                'head_events', 'head_caravans', 'head_ethics', 'head_quran',
                'head_marketing', 'head_ashbal', 'head_hr', 'hr'
            )
        )
        OR EXISTS (
            SELECT 1 FROM public.course_lectures cl
            JOIN public.courses c ON c.id = cl.course_id
            WHERE cl.id = course_attendance.lecture_id
            AND (c.branch_id = public.get_my_branch_id() OR c.created_by = auth.uid())
        )
    );
