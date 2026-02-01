-- Fix RLS policies to support multiple organizers

-- 1. Update quran_circle_sessions policy
DROP POLICY IF EXISTS "Allow organizer to manage sessions" ON public.quran_circle_sessions;

CREATE POLICY "Allow organizer to manage sessions" ON public.quran_circle_sessions
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.quran_circle_organizers
        WHERE circle_id = quran_circle_sessions.circle_id 
        AND volunteer_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.quran_circle_organizers
        WHERE circle_id = quran_circle_sessions.circle_id 
        AND volunteer_id = auth.uid()
    )
);

-- 2. Update quran_circle_beneficiaries policy (Attendance)
DROP POLICY IF EXISTS "Allow organizer to manage attendance" ON public.quran_circle_beneficiaries;

CREATE POLICY "Allow organizer to manage attendance" ON public.quran_circle_beneficiaries
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.quran_circle_organizers
        WHERE circle_id = quran_circle_beneficiaries.circle_id 
        AND volunteer_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.quran_circle_organizers
        WHERE circle_id = quran_circle_beneficiaries.circle_id 
        AND volunteer_id = auth.uid()
    )
);
