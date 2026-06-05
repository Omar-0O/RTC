-- ============================================================================
-- FIX: Follow-up security & performance improvements
-- ============================================================================
-- 1. Add DELETE policy on users_followup (was missing)
-- 2. Add index on activity_submissions.guest_phone for participations query
-- 3. Add index on users_followup.phone_1 for duplicate checks
-- ============================================================================

-- 1. DELETE policy — scoped to branch like the other policies
DROP POLICY IF EXISTS "uf_delete" ON public.users_followup;
CREATE POLICY "uf_delete" ON public.users_followup FOR DELETE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

-- 2. Index on guest_phone for fast participations lookups
-- The participations query does ilike on guest_phone which causes full table scans
CREATE INDEX IF NOT EXISTS idx_activity_submissions_guest_phone
  ON public.activity_submissions (guest_phone)
  WHERE guest_phone IS NOT NULL;

-- 3. Index on phone_1 for fast duplicate checks during sync
CREATE INDEX IF NOT EXISTS idx_users_followup_phone_1
  ON public.users_followup (phone_1);

-- 4. Composite index for the common query pattern: status + branch_id
CREATE INDEX IF NOT EXISTS idx_users_followup_status_branch
  ON public.users_followup (status, branch_id);
