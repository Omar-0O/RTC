-- Fix permissions for all committee heads and admin roles across all course-related tables

-- 1. Courses Table
DROP POLICY IF EXISTS "Manage courses for heads" ON public.courses;
CREATE POLICY "Manage courses for heads" ON public.courses
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles 
            WHERE role IN (
                'admin', 'executive', 'branch_admin', 'supervisor',
                'committee_leader', 'head_production', 'head_fourth_year',
                'head_events', 'head_caravans', 'head_ethics', 'head_quran',
                'head_marketing', 'head_ashbal', 'head_hr'
            )
        )
    );

-- 2. Course Organizers Table
DROP POLICY IF EXISTS "View course organizers for heads" ON public.course_organizers;
CREATE POLICY "View course organizers for heads" ON public.course_organizers
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Manage course organizers for heads" ON public.course_organizers;
CREATE POLICY "Manage course organizers for heads" ON public.course_organizers
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles 
            WHERE role IN (
                'admin', 'executive', 'branch_admin', 'supervisor',
                'committee_leader', 'head_production', 'head_fourth_year',
                'head_events', 'head_caravans', 'head_ethics', 'head_quran',
                'head_marketing', 'head_ashbal', 'head_hr'
            )
        )
    );

-- 3. Course Lectures Table
DROP POLICY IF EXISTS "View course lectures for heads" ON public.course_lectures;
CREATE POLICY "View course lectures for heads" ON public.course_lectures
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Manage course lectures for heads" ON public.course_lectures;
CREATE POLICY "Manage course lectures for heads" ON public.course_lectures
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles 
            WHERE role IN (
                'admin', 'executive', 'branch_admin', 'supervisor',
                'committee_leader', 'head_production', 'head_fourth_year',
                'head_events', 'head_caravans', 'head_ethics', 'head_quran',
                'head_marketing', 'head_ashbal', 'head_hr'
            )
        )
    );

-- 4. Course Trainers Table
DROP POLICY IF EXISTS "Manage course trainers" ON public.course_trainers;
CREATE POLICY "Manage course trainers" ON public.course_trainers
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles 
            WHERE role IN (
                'admin', 'executive', 'branch_admin', 'supervisor',
                'committee_leader', 'head_production', 'head_fourth_year',
                'head_events', 'head_caravans', 'head_ethics', 'head_quran',
                'head_marketing', 'head_ashbal', 'head_hr'
            )
        )
    );

-- 5. Course Marketers Table
DROP POLICY IF EXISTS "course_marketers_insert" ON public.course_marketers;
CREATE POLICY "course_marketers_insert" ON public.course_marketers 
    FOR INSERT TO authenticated 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN (
                'admin', 'executive', 'branch_admin', 'supervisor',
                'committee_leader', 'head_production', 'head_fourth_year',
                'head_events', 'head_caravans', 'head_ethics', 'head_quran',
                'head_marketing', 'head_ashbal', 'head_hr', 'marketing_member'
            )
        )
    );

DROP POLICY IF EXISTS "course_marketers_delete" ON public.course_marketers;
CREATE POLICY "course_marketers_delete" ON public.course_marketers 
    FOR DELETE TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN (
                'admin', 'executive', 'branch_admin', 'supervisor',
                'committee_leader', 'head_production', 'head_fourth_year',
                'head_events', 'head_caravans', 'head_ethics', 'head_quran',
                'head_marketing', 'head_ashbal', 'head_hr', 'marketing_member'
            )
        )
    );

-- 6. Course Ads Table
DROP POLICY IF EXISTS "course_ads_insert" ON public.course_ads;
CREATE POLICY "course_ads_insert" ON public.course_ads 
    FOR INSERT TO authenticated 
    WITH CHECK (
        EXISTS (SELECT 1 FROM course_marketers WHERE course_id = course_ads.course_id AND volunteer_id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN (
                'admin', 'executive', 'branch_admin', 'supervisor',
                'committee_leader', 'head_production', 'head_fourth_year',
                'head_events', 'head_caravans', 'head_ethics', 'head_quran',
                'head_marketing', 'head_ashbal', 'head_hr', 'marketing_member'
            )
        )
    );

DROP POLICY IF EXISTS "course_ads_update" ON public.course_ads;
CREATE POLICY "course_ads_update" ON public.course_ads 
    FOR UPDATE TO authenticated 
    USING (
        EXISTS (SELECT 1 FROM course_marketers WHERE course_id = course_ads.course_id AND volunteer_id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN (
                'admin', 'executive', 'branch_admin', 'supervisor',
                'committee_leader', 'head_production', 'head_fourth_year',
                'head_events', 'head_caravans', 'head_ethics', 'head_quran',
                'head_marketing', 'head_ashbal', 'head_hr', 'marketing_member'
            )
        )
    );

DROP POLICY IF EXISTS "course_ads_delete" ON public.course_ads;
CREATE POLICY "course_ads_delete" ON public.course_ads 
    FOR DELETE TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN (
                'admin', 'executive', 'branch_admin', 'supervisor',
                'committee_leader', 'head_production', 'head_fourth_year',
                'head_events', 'head_caravans', 'head_ethics', 'head_quran',
                'head_marketing', 'head_ashbal', 'head_hr'
            )
        )
    );

-- 7. Course Beneficiaries Table
DROP POLICY IF EXISTS "View course beneficiaries for heads" ON public.course_beneficiaries;
CREATE POLICY "View course beneficiaries for heads" ON public.course_beneficiaries
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Manage course beneficiaries for heads" ON public.course_beneficiaries;
CREATE POLICY "Manage course beneficiaries for heads" ON public.course_beneficiaries
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles 
            WHERE role IN (
                'admin', 'executive', 'branch_admin', 'supervisor',
                'committee_leader', 'head_production', 'head_fourth_year',
                'head_events', 'head_caravans', 'head_ethics', 'head_quran',
                'head_marketing', 'head_ashbal', 'head_hr'
            )
        )
    );

-- 8. Course Attendance Table
DROP POLICY IF EXISTS "View course attendance for heads" ON public.course_attendance;
CREATE POLICY "View course attendance for heads" ON public.course_attendance
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Manage course attendance for heads" ON public.course_attendance;
CREATE POLICY "Manage course attendance for heads" ON public.course_attendance
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles 
            WHERE role IN (
                'admin', 'executive', 'branch_admin', 'supervisor',
                'committee_leader', 'head_production', 'head_fourth_year',
                'head_events', 'head_caravans', 'head_ethics', 'head_quran',
                'head_marketing', 'head_ashbal', 'head_hr'
            )
        )
    );

-- 9. Quran Beneficiaries Table (Allow Quran Circle Organizers to add & edit students/beneficiaries)
DROP POLICY IF EXISTS quran_beneficiaries_manage ON public.quran_beneficiaries;
DROP POLICY IF EXISTS "Allow insert for authenticated" ON public.quran_beneficiaries;
DROP POLICY IF EXISTS "Allow update for authenticated" ON public.quran_beneficiaries;

CREATE POLICY quran_beneficiaries_manage ON public.quran_beneficiaries 
FOR ALL TO authenticated
USING (
    public.is_admin_or_exec() 
    OR (branch_id = public.get_my_branch_id() AND public.has_role(auth.uid(), 'head_quran'))
    OR EXISTS (
        SELECT 1 FROM public.quran_circle_organizers o 
        JOIN public.quran_circles c ON c.id = o.circle_id 
        WHERE o.volunteer_id = auth.uid()
    )
)
WITH CHECK (
    public.is_admin_or_exec() 
    OR (branch_id = public.get_my_branch_id() AND public.has_role(auth.uid(), 'head_quran'))
    OR EXISTS (
        SELECT 1 FROM public.quran_circle_organizers o 
        JOIN public.quran_circles c ON c.id = o.circle_id 
        WHERE o.volunteer_id = auth.uid()
    )
);

