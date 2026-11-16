-- Migration: Allow kiosk service accounts and branch users to read unassigned (branch_id IS NULL)
-- and cross-branch volunteer profiles for group participations in Field Kiosk & Log Activity.

BEGIN;

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    public.is_admin_or_exec()
    OR branch_id = public.get_my_branch_id()
    OR branch_id IS NULL
    OR lower(COALESCE(auth.jwt() ->> 'email', '')) IN ('medaniparticipations@rtc.org', 'kiosk@rtc.internal')
  );

COMMIT;
