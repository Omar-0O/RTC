-- Grant full admin-like permissions to course organizers for their assigned courses

-- 1. Policies for course_lectures
DROP POLICY IF EXISTS "Organizers can manage course lectures" ON public.course_lectures;
CREATE POLICY "Organizers can manage course lectures" ON public.course_lectures
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.course_organizers
            WHERE course_organizers.course_id = course_lectures.course_id
            AND course_organizers.volunteer_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.course_organizers
            WHERE course_organizers.course_id = course_lectures.course_id
            AND course_organizers.volunteer_id = auth.uid()
        )
    );


-- 2. Policies for course_beneficiaries
DROP POLICY IF EXISTS "Organizers can manage course beneficiaries" ON public.course_beneficiaries;
CREATE POLICY "Organizers can manage course beneficiaries" ON public.course_beneficiaries
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.course_organizers
            WHERE course_organizers.course_id = course_beneficiaries.course_id
            AND course_organizers.volunteer_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.course_organizers
            WHERE course_organizers.course_id = course_beneficiaries.course_id
            AND course_organizers.volunteer_id = auth.uid()
        )
    );


-- 3. Policies for course_attendance
-- Attendance is linked to course via lecture_id
DROP POLICY IF EXISTS "Organizers can manage course attendance" ON public.course_attendance;
CREATE POLICY "Organizers can manage course attendance" ON public.course_attendance
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.course_organizers
            JOIN public.course_lectures ON course_lectures.course_id = course_organizers.course_id
            WHERE course_lectures.id = course_attendance.lecture_id
            AND course_organizers.volunteer_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.course_organizers
            JOIN public.course_lectures ON course_lectures.course_id = course_organizers.course_id
            WHERE course_lectures.id = course_attendance.lecture_id
            AND course_organizers.volunteer_id = auth.uid()
        )
    );
