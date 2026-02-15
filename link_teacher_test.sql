-- Script to link a teacher to the current user for testing purposes
-- This will allow you to test the participation trigger.

-- 1. Find a teacher to link (e.g., 'ابراهيم محمد' or any teacher)
-- You can change the name pattern to match the teacher you are using.
UPDATE public.quran_teachers
SET user_id = auth.uid()
WHERE id = (
    SELECT id FROM public.quran_teachers
    LIMIT 1 -- Just pick the first one for testing, OR modify to WHERE name LIKE '%Desired Name%'
);

-- 2. Verify the link
SELECT id, name, user_id FROM public.quran_teachers WHERE user_id = auth.uid();
