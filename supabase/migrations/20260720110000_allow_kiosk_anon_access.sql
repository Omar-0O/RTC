-- Migration to allow anonymous (anon) kiosk access to read schedules and log field participations

-- 1. Courses SELECT for anon
DROP POLICY IF EXISTS "co_select_anon" ON public.courses;
CREATE POLICY "co_select_anon" ON public.courses FOR SELECT TO anon USING (true);

-- 2. Quran Circles SELECT for anon
DROP POLICY IF EXISTS "qc_select_anon" ON public.quran_circles;
CREATE POLICY "qc_select_anon" ON public.quran_circles FOR SELECT TO anon USING (true);

-- 3. Quran Teachers SELECT for anon
DROP POLICY IF EXISTS "qt_select_anon" ON public.quran_teachers;
CREATE POLICY "qt_select_anon" ON public.quran_teachers FOR SELECT TO anon USING (true);

-- 4. Branches SELECT for anon
DROP POLICY IF EXISTS "branches_select_anon" ON public.branches;
CREATE POLICY "branches_select_anon" ON public.branches FOR SELECT TO anon USING (true);

-- 5. Committees SELECT for anon
DROP POLICY IF EXISTS "cm_select_anon" ON public.committees;
CREATE POLICY "cm_select_anon" ON public.committees FOR SELECT TO anon USING (true);

-- 6. Activity Types SELECT for anon
DROP POLICY IF EXISTS "at_select_anon" ON public.activity_types;
CREATE POLICY "at_select_anon" ON public.activity_types FOR SELECT TO anon USING (true);

-- 7. Activity Type Committees SELECT for anon
DROP POLICY IF EXISTS "atc_select_anon" ON public.activity_type_committees;
CREATE POLICY "atc_select_anon" ON public.activity_type_committees FOR SELECT TO anon USING (true);

-- 8. Profiles SELECT for anon (for kiosk volunteer phone verification)
DROP POLICY IF EXISTS "profiles_select_anon" ON public.profiles;
CREATE POLICY "profiles_select_anon" ON public.profiles FOR SELECT TO anon USING (true);

-- 9. Activity Submissions SELECT and INSERT for anon (for kiosk check-ins)
DROP POLICY IF EXISTS "as_select_anon" ON public.activity_submissions;
CREATE POLICY "as_select_anon" ON public.activity_submissions FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "as_insert_anon" ON public.activity_submissions;
CREATE POLICY "as_insert_anon" ON public.activity_submissions FOR INSERT TO anon WITH CHECK (true);

-- 10. User Roles SELECT for anon (for kiosk role verification)
DROP POLICY IF EXISTS "ur_select_anon" ON public.user_roles;
CREATE POLICY "ur_select_anon" ON public.user_roles FOR SELECT TO anon USING (true);

-- 11. Group Submissions SELECT and INSERT for anon (for kiosk group check-ins)
DROP POLICY IF EXISTS "gs_select_anon" ON public.group_submissions;
CREATE POLICY "gs_select_anon" ON public.group_submissions FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "gs_insert_anon" ON public.group_submissions;
CREATE POLICY "gs_insert_anon" ON public.group_submissions FOR INSERT TO anon WITH CHECK (true);

