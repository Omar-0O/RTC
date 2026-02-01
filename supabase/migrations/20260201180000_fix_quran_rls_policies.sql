-- Fix RLS policies for quran_circle_sessions and quran_circle_beneficiaries

-- Allow organizers to create/update sessions in their circles
DROP POLICY IF EXISTS "Organizers can manage sessions" ON quran_circle_sessions;
CREATE POLICY "Organizers can manage sessions" ON quran_circle_sessions
FOR ALL
USING (
    circle_id IN (
        SELECT circle_id FROM quran_circle_organizers 
        WHERE volunteer_id = auth.uid()
    )
)
WITH CHECK (
    circle_id IN (
        SELECT circle_id FROM quran_circle_organizers 
        WHERE volunteer_id = auth.uid()
    )
);

-- Allow all authenticated users to read sessions
DROP POLICY IF EXISTS "Authenticated users can view sessions" ON quran_circle_sessions;
CREATE POLICY "Authenticated users can view sessions" ON quran_circle_sessions
FOR SELECT
USING (auth.role() = 'authenticated');

-- Allow organizers to manage attendance in their circles
DROP POLICY IF EXISTS "Organizers can manage attendance" ON quran_circle_beneficiaries;
CREATE POLICY "Organizers can manage attendance" ON quran_circle_beneficiaries
FOR ALL
USING (
    circle_id IN (
        SELECT circle_id FROM quran_circle_organizers 
        WHERE volunteer_id = auth.uid()
    )
)
WITH CHECK (
    circle_id IN (
        SELECT circle_id FROM quran_circle_organizers 
        WHERE volunteer_id = auth.uid()
    )
);

-- Allow authenticated users to read attendance
DROP POLICY IF EXISTS "Authenticated users can view attendance" ON quran_circle_beneficiaries;
CREATE POLICY "Authenticated users can view attendance" ON quran_circle_beneficiaries
FOR SELECT
USING (auth.role() = 'authenticated');

-- Allow organizers to view their circles
DROP POLICY IF EXISTS "Organizers can view their circles" ON quran_circles;
CREATE POLICY "Organizers can view their circles" ON quran_circles
FOR SELECT
USING (
    id IN (
        SELECT circle_id FROM quran_circle_organizers 
        WHERE volunteer_id = auth.uid()
    )
    OR auth.role() = 'authenticated'
);
