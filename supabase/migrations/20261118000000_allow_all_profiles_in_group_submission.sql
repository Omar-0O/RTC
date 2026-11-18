-- ============================================================================
-- Migration: Allow authenticated users to read all profiles for Group Submission
-- Why:
--   1. In Group Submission (LogActivity & FieldLogging), leaders, supervisors,
--      officials, and authorized volunteers need to select participants—including
--      officials ("مسؤولين"), unassigned profiles (branch_id IS NULL), and
--      cross-branch participants.
--   2. Previously, `profiles_select` restricted non-admin/non-exec callers to
--      `branch_id = get_my_branch_id() OR branch_id IS NULL`, hiding officials
--      and volunteers registered under another branch (or defaulted to the
--      default branch on creation).
-- Safety:
--   - Uses lock_timeout and statement_timeout guards (write-safe-migrations).
--   - Only relaxes SELECT visibility on `public.profiles` for `authenticated`
--     users; INSERT/UPDATE/DELETE policies remain strictly branch- and role-scoped.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

COMMIT;
