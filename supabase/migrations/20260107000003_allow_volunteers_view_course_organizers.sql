-- Allow volunteers to see their own course organizer records
-- This is necessary for the sidebar 'My Courses' check to work

DROP POLICY IF EXISTS "Organizers can view their own organizer records" ON public.course_organizers;

CREATE POLICY "Organizers can view their own organizer records" ON public.course_organizers
    FOR SELECT USING (
        volunteer_id = auth.uid()
    );
