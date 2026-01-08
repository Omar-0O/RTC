-- Allow organizers to update their assigned courses (e.g. for certificate status)
DROP POLICY IF EXISTS "Organizers can update their courses" ON public.courses;
CREATE POLICY "Organizers can update their courses" ON public.courses
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.course_organizers
            WHERE course_organizers.course_id = courses.id
            AND course_organizers.volunteer_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.course_organizers
            WHERE course_organizers.course_id = courses.id
            AND course_organizers.volunteer_id = auth.uid()
        )
    );
