-- Clean up the wide-open anon RLS policies that were added for kiosk access.
-- Now that the kiosk uses a dedicated authenticated service account,
-- these policies are redundant and unnecessarily expose data to unauthenticated users.

-- Remove anon SELECT policies
DROP POLICY IF EXISTS "co_select_anon" ON public.courses;
DROP POLICY IF EXISTS "qc_select_anon" ON public.quran_circles;
DROP POLICY IF EXISTS "qt_select_anon" ON public.quran_teachers;
DROP POLICY IF EXISTS "branches_select_anon" ON public.branches;
DROP POLICY IF EXISTS "cm_select_anon" ON public.committees;
DROP POLICY IF EXISTS "at_select_anon" ON public.activity_types;
DROP POLICY IF EXISTS "atc_select_anon" ON public.activity_type_committees;
DROP POLICY IF EXISTS "profiles_select_anon" ON public.profiles;
DROP POLICY IF EXISTS "as_select_anon" ON public.activity_submissions;
DROP POLICY IF EXISTS "ur_select_anon" ON public.user_roles;
DROP POLICY IF EXISTS "gs_select_anon" ON public.group_submissions;

-- Remove anon INSERT policies
DROP POLICY IF EXISTS "as_insert_anon" ON public.activity_submissions;
DROP POLICY IF EXISTS "gs_insert_anon" ON public.group_submissions;

-- Remove anon storage policy for avatars
DROP POLICY IF EXISTS "avatars_select_anon" ON storage.objects;
