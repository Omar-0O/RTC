-- ============================================================================
-- Row Level Security (RLS) Policies
--
-- Migrates access control from client-side branch_id filtering to
-- database-enforced RLS. This is the ONLY source of truth for access control.
--
-- AFFECTED TABLES:
--   profiles, user_roles, activity_submissions, users_followup, committees,
--   quran_circles, quran_circle_sessions, quran_beneficiaries, quran_enrollments
--
-- PRINCIPLE: admin/executive see all; others see only their branch.
--
-- NOTE: This migration is superseded by 20260509000000_enforce_branch_rls.sql
-- which drops all these policies and recreates them with stricter branch scoping.
-- Kept idempotent (DROP IF EXISTS) so it can be re-run safely.
-- ============================================================================


-- Keep the idemptonet pattern for dropping policies

-- ────────────────────────────────────────────────────────────────────────────
-- Helper: get the current user's branch_id from their profile
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_branch_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT branch_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Helper: check if current user is admin or executive
CREATE OR REPLACE FUNCTION public.is_admin_or_executive()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'executive')
  );
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- PROFILES
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'head_hr', 'hr', 'supervisor')
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- USERS_FOLLOWUP — branch-scoped
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.users_followup ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "followup_select_branch" ON public.users_followup;
CREATE POLICY "followup_select_branch"
  ON public.users_followup FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_executive()
    OR branch_id = public.get_user_branch_id()
  );

DROP POLICY IF EXISTS "followup_insert_branch" ON public.users_followup;
CREATE POLICY "followup_insert_branch"
  ON public.users_followup FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_executive()
    OR branch_id = public.get_user_branch_id()
  );

DROP POLICY IF EXISTS "followup_update_branch" ON public.users_followup;
CREATE POLICY "followup_update_branch"
  ON public.users_followup FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_or_executive()
    OR branch_id = public.get_user_branch_id()
  );

-- ────────────────────────────────────────────────────────────────────────────
-- ACTIVITY_SUBMISSIONS — branch-scoped
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.activity_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_select_branch" ON public.activity_submissions;
CREATE POLICY "activity_select_branch"
  ON public.activity_submissions FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_executive()
    OR volunteer_id = auth.uid()
    OR branch_id = public.get_user_branch_id()
  );

DROP POLICY IF EXISTS "activity_insert_own" ON public.activity_submissions;
CREATE POLICY "activity_insert_own"
  ON public.activity_submissions FOR INSERT
  TO authenticated
  WITH CHECK (volunteer_id = auth.uid() OR public.is_admin_or_executive());

-- ────────────────────────────────────────────────────────────────────────────
-- COMMITTEES — readable by all authenticated users
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.committees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "committees_select_all" ON public.committees;
CREATE POLICY "committees_select_all"
  ON public.committees FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "committees_modify_admin" ON public.committees;
CREATE POLICY "committees_modify_admin"
  ON public.committees FOR ALL
  TO authenticated
  USING (public.is_admin_or_executive());

-- ────────────────────────────────────────────────────────────────────────────
-- QURAN_CIRCLES — readable by all, writable by admin/quran head
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.quran_circles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "circles_select_all" ON public.quran_circles;
CREATE POLICY "circles_select_all"
  ON public.quran_circles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "circles_modify_admin" ON public.quran_circles;
CREATE POLICY "circles_modify_admin"
  ON public.quran_circles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'executive', 'head_quran')
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- USER_ROLES — only admin can modify; all can read
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_select_all" ON public.user_roles;
CREATE POLICY "roles_select_all"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "roles_modify_admin" ON public.user_roles;
CREATE POLICY "roles_modify_admin"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.is_admin_or_executive());
