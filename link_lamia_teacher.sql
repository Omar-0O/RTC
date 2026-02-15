-- Link the specific teacher 'لمياء كامل' (Lamia Kamel) to the current user
-- Run this script in the SQL Editor

UPDATE public.quran_teachers
SET user_id = auth.uid()
WHERE name LIKE '%لمياء كامل%' OR name LIKE '%Lamia Kamel%';

-- Verify the update
SELECT id, name, user_id FROM public.quran_teachers WHERE user_id = auth.uid();
