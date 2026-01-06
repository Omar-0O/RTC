-- Add volunteer_id to course_organizers to link organizers with their user accounts
ALTER TABLE public.course_organizers
ADD COLUMN IF NOT EXISTS volunteer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_course_organizers_volunteer_id ON public.course_organizers(volunteer_id);

-- Add RLS policy for organizers to view/edit their courses
DROP POLICY IF EXISTS "Organizers can view their courses" ON public.courses;
CREATE POLICY "Organizers can view their courses" ON public.courses
    FOR SELECT USING (
        id IN (
            SELECT course_id FROM public.course_organizers
            WHERE volunteer_id = auth.uid()
        )
        OR true -- Everyone can view courses
    );

DROP POLICY IF EXISTS "Organizers can update their courses" ON public.courses;
CREATE POLICY "Organizers can update their courses" ON public.courses
    FOR UPDATE USING (
        id IN (
            SELECT course_id FROM public.course_organizers
            WHERE volunteer_id = auth.uid()
        )
        OR auth.uid() IN (
            SELECT user_id FROM public.user_roles
            WHERE role IN ('admin', 'supervisor', 'head_production', 'head_fourth_year', 'head_events', 'head_caravans', 'committee_leader')
        )
    );
