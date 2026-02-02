-- Fix permissions for head_marketing and head_hr to manage courses

-- 1. Courses Table Policies
DROP POLICY IF EXISTS "Manage courses for heads" ON public.courses;
CREATE POLICY "Manage courses for heads" ON public.courses
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles 
            WHERE role IN ('admin', 'supervisor', 'head_production', 'head_fourth_year', 'head_events', 'head_caravans', 'committee_leader', 'head_marketing', 'head_hr')
        )
    );

-- 2. Course Organizers Table Policies
DROP POLICY IF EXISTS "View course organizers for heads" ON public.course_organizers;
CREATE POLICY "View course organizers for heads" ON public.course_organizers
    FOR SELECT USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles 
            WHERE role IN ('admin', 'supervisor', 'head_production', 'head_fourth_year', 'head_events', 'head_caravans', 'committee_leader', 'head_marketing', 'head_hr')
        )
    );

DROP POLICY IF EXISTS "Manage course organizers for heads" ON public.course_organizers;
CREATE POLICY "Manage course organizers for heads" ON public.course_organizers
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles 
            WHERE role IN ('admin', 'supervisor', 'head_production', 'head_fourth_year', 'head_events', 'head_caravans', 'committee_leader', 'head_marketing', 'head_hr')
        )
    );

-- 3. Course Lectures Table Policies
DROP POLICY IF EXISTS "View course lectures for heads" ON public.course_lectures;
CREATE POLICY "View course lectures for heads" ON public.course_lectures
    FOR SELECT USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles 
            WHERE role IN ('admin', 'supervisor', 'head_production', 'head_fourth_year', 'head_events', 'head_caravans', 'committee_leader', 'head_marketing', 'head_hr')
        )
    );

DROP POLICY IF EXISTS "Manage course lectures for heads" ON public.course_lectures;
CREATE POLICY "Manage course lectures for heads" ON public.course_lectures
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles 
            WHERE role IN ('admin', 'supervisor', 'head_production', 'head_fourth_year', 'head_events', 'head_caravans', 'committee_leader', 'head_marketing', 'head_hr')
        )
    );

-- 4. Course Ads Policies
DROP POLICY IF EXISTS "course_ads_insert" ON public.course_ads;
CREATE POLICY "course_ads_insert" ON public.course_ads 
    FOR INSERT TO authenticated 
    WITH CHECK (
        EXISTS (SELECT 1 FROM course_marketers WHERE course_id = course_ads.course_id AND volunteer_id = auth.uid())
        OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor', 'committee_leader', 'head_marketing', 'head_hr'))
    );

DROP POLICY IF EXISTS "course_ads_update" ON public.course_ads;
CREATE POLICY "course_ads_update" ON public.course_ads 
    FOR UPDATE TO authenticated 
    USING (
        EXISTS (SELECT 1 FROM course_marketers WHERE course_id = course_ads.course_id AND volunteer_id = auth.uid())
        OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor', 'committee_leader', 'head_marketing', 'head_hr'))
    );

DROP POLICY IF EXISTS "course_ads_delete" ON public.course_ads;
CREATE POLICY "course_ads_delete" ON public.course_ads 
    FOR DELETE TO authenticated 
    USING (
        EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor', 'head_marketing', 'head_hr'))
    );

-- 5. Course Marketers Policies
DROP POLICY IF EXISTS "course_marketers_insert" ON public.course_marketers;
CREATE POLICY "course_marketers_insert" ON public.course_marketers 
    FOR INSERT TO authenticated 
    WITH CHECK (
        EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor', 'committee_leader', 'head_marketing', 'head_hr'))
    );

DROP POLICY IF EXISTS "course_marketers_delete" ON public.course_marketers;
CREATE POLICY "course_marketers_delete" ON public.course_marketers 
    FOR DELETE TO authenticated 
    USING (
        EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor', 'committee_leader', 'head_marketing', 'head_hr'))
    );
