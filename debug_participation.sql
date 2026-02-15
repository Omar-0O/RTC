-- Diagnostic script to check data relevant to participation triggering

-- 1. Check Committees
SELECT id, name, name_ar FROM public.committees WHERE name LIKE '%Quran%' OR name_ar LIKE '%قرآن%';

-- 2. Check Activity Types
SELECT id, name, name_ar, points FROM public.activity_types WHERE name LIKE '%Quran%' OR name_ar LIKE '%قرآن%';

-- 3. Check Quran Teachers (user_id linkage)
SELECT id, name, user_id FROM public.quran_teachers LIMIT 10;

-- 4. Check Circles and their Teachers
SELECT c.id as circle_id, c.teacher_id, t.name as teacher_name, t.user_id as teacher_user_id
FROM public.quran_circles c
LEFT JOIN public.quran_teachers t ON c.teacher_id = t.id
LIMIT 5;
