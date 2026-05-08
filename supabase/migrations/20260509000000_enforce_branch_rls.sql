-- ============================================================================
-- MULTI-TENANT HARD ISOLATION — PHASE 1
-- Add branch_id everywhere, backfill, RLS, indexes, auto-inject trigger
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 0a. FIX: Recreate bump_version() to safely handle tables without updated_at
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.bump_version()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.version := COALESCE(OLD.version, 0) + 1;
  -- Only set updated_at if the column exists on this table
  IF TG_ARGV IS NULL THEN
    BEGIN
      NEW.updated_at := now();
    EXCEPTION WHEN undefined_column THEN
      -- table has no updated_at column, skip
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 0b. HELPER FUNCTIONS (idempotent recreate)
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_branch_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT branch_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_exec()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role::text IN ('admin','executive')
  );
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. ADD branch_id TO TABLES THAT DON'T HAVE IT YET
-- ────────────────────────────────────────────────────────────────────────────

-- committees
ALTER TABLE public.committees ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);
UPDATE public.committees SET branch_id = get_default_branch_id() WHERE branch_id IS NULL;

-- activity_types
ALTER TABLE public.activity_types ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);
UPDATE public.activity_types SET branch_id = get_default_branch_id() WHERE branch_id IS NULL;

-- fine_types
ALTER TABLE public.fine_types ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);
UPDATE public.fine_types SET branch_id = get_default_branch_id() WHERE branch_id IS NULL;

-- badges
ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);
UPDATE public.badges SET branch_id = get_default_branch_id() WHERE branch_id IS NULL;

-- volunteer_feedbacks
ALTER TABLE public.volunteer_feedbacks ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);
UPDATE public.volunteer_feedbacks vf
  SET branch_id = COALESCE(
    (SELECT p.branch_id FROM public.profiles p WHERE p.id = vf.volunteer_id),
    get_default_branch_id()
  )
WHERE vf.branch_id IS NULL;

-- volunteer_fines
ALTER TABLE public.volunteer_fines ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);
UPDATE public.volunteer_fines vf
  SET branch_id = COALESCE(
    (SELECT p.branch_id FROM public.profiles p WHERE p.id = vf.volunteer_id),
    get_default_branch_id()
  )
WHERE vf.branch_id IS NULL;

-- interested_beneficiaries
ALTER TABLE public.interested_beneficiaries ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);
UPDATE public.interested_beneficiaries SET branch_id = get_default_branch_id() WHERE branch_id IS NULL;

-- group_submissions
ALTER TABLE public.group_submissions ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);
UPDATE public.group_submissions gs
  SET branch_id = COALESCE(
    (SELECT p.branch_id FROM public.profiles p WHERE p.id = gs.leader_id),
    get_default_branch_id()
  )
WHERE gs.branch_id IS NULL;

-- user_badges
ALTER TABLE public.user_badges ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);
UPDATE public.user_badges ub
  SET branch_id = COALESCE(
    (SELECT p.branch_id FROM public.profiles p WHERE p.id = ub.user_id),
    get_default_branch_id()
  )
WHERE ub.branch_id IS NULL;

-- quran_teachers
ALTER TABLE public.quran_teachers ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);
UPDATE public.quran_teachers SET branch_id = get_default_branch_id() WHERE branch_id IS NULL;

-- quran_beneficiaries
ALTER TABLE public.quran_beneficiaries ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);
UPDATE public.quran_beneficiaries SET branch_id = get_default_branch_id() WHERE branch_id IS NULL;

-- Backfill any remaining NULLs on pre-existing tables
UPDATE public.profiles SET branch_id = get_default_branch_id() WHERE branch_id IS NULL;
UPDATE public.activity_submissions SET branch_id = get_default_branch_id() WHERE branch_id IS NULL;
UPDATE public.trainers SET branch_id = get_default_branch_id() WHERE branch_id IS NULL;
UPDATE public.courses SET branch_id = get_default_branch_id() WHERE branch_id IS NULL;
UPDATE public.quran_circles SET branch_id = get_default_branch_id() WHERE branch_id IS NULL;
UPDATE public.caravans SET branch_id = get_default_branch_id() WHERE branch_id IS NULL;
UPDATE public.events SET branch_id = get_default_branch_id() WHERE branch_id IS NULL;
UPDATE public.users_followup SET branch_id = get_default_branch_id() WHERE branch_id IS NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. INDEXES on branch_id
-- ────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_profiles_branch ON public.profiles(branch_id);
CREATE INDEX IF NOT EXISTS idx_activity_submissions_branch ON public.activity_submissions(branch_id);
CREATE INDEX IF NOT EXISTS idx_users_followup_branch ON public.users_followup(branch_id);
CREATE INDEX IF NOT EXISTS idx_trainers_branch ON public.trainers(branch_id);
CREATE INDEX IF NOT EXISTS idx_courses_branch ON public.courses(branch_id);
CREATE INDEX IF NOT EXISTS idx_quran_circles_branch ON public.quran_circles(branch_id);
CREATE INDEX IF NOT EXISTS idx_caravans_branch ON public.caravans(branch_id);
CREATE INDEX IF NOT EXISTS idx_events_branch ON public.events(branch_id);
CREATE INDEX IF NOT EXISTS idx_committees_branch ON public.committees(branch_id);
CREATE INDEX IF NOT EXISTS idx_activity_types_branch ON public.activity_types(branch_id);
CREATE INDEX IF NOT EXISTS idx_fine_types_branch ON public.fine_types(branch_id);
CREATE INDEX IF NOT EXISTS idx_badges_branch ON public.badges(branch_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_feedbacks_branch ON public.volunteer_feedbacks(branch_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_fines_branch ON public.volunteer_fines(branch_id);
CREATE INDEX IF NOT EXISTS idx_interested_beneficiaries_branch ON public.interested_beneficiaries(branch_id);
CREATE INDEX IF NOT EXISTS idx_group_submissions_branch ON public.group_submissions(branch_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_branch ON public.user_badges(branch_id);
CREATE INDEX IF NOT EXISTS idx_quran_teachers_branch ON public.quran_teachers(branch_id);
CREATE INDEX IF NOT EXISTS idx_quran_beneficiaries_branch ON public.quran_beneficiaries(branch_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. AUTO-INJECT TRIGGER: set branch_id from auth user on INSERT
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auto_set_branch_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user_branch uuid;
  _is_admin boolean;
BEGIN
  -- Get caller info
  SELECT branch_id INTO _user_branch FROM public.profiles WHERE id = auth.uid();
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role::text IN ('admin','executive')
  ) INTO _is_admin;

  -- If admin provided a branch_id explicitly, allow it
  IF _is_admin AND NEW.branch_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Otherwise force caller's branch
  NEW.branch_id := COALESCE(_user_branch, get_default_branch_id());
  RETURN NEW;
END;
$$;

-- Apply trigger to all branch-scoped tables
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'activity_submissions','users_followup','trainers','courses',
    'quran_circles','caravans','events','committees','activity_types',
    'fine_types','badges','volunteer_feedbacks','volunteer_fines',
    'interested_beneficiaries','group_submissions','user_badges',
    'quran_teachers','quran_beneficiaries'
  ]) LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_auto_branch_%I ON public.%I;
       CREATE TRIGGER trg_auto_branch_%I
         BEFORE INSERT ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.auto_set_branch_id();',
      tbl, tbl, tbl, tbl
    );
  END LOOP;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. DROP ALL EXISTING RLS POLICIES (clean slate)
-- ────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename, schemaname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles','activity_submissions','users_followup','trainers',
        'courses','quran_circles','caravans','events','committees',
        'activity_types','fine_types','badges','volunteer_feedbacks',
        'volunteer_fines','interested_beneficiaries','group_submissions',
        'user_badges','quran_teachers','quran_beneficiaries','user_roles'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. ENABLE RLS + CREATE BRANCH-SCOPED POLICIES
-- ────────────────────────────────────────────────────────────────────────────

-- ── PROFILES ──
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role::text IN ('admin','head_hr','hr','supervisor','executive')));

CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

-- ── USER_ROLES (global read, admin write) ──
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roles_select" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_modify" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin_or_exec());

-- ── ACTIVITY_SUBMISSIONS ──
ALTER TABLE public.activity_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "as_select" ON public.activity_submissions FOR SELECT TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "as_insert" ON public.activity_submissions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "as_update" ON public.activity_submissions FOR UPDATE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "as_delete" ON public.activity_submissions FOR DELETE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

-- ── USERS_FOLLOWUP ──
ALTER TABLE public.users_followup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uf_select" ON public.users_followup FOR SELECT TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "uf_insert" ON public.users_followup FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "uf_update" ON public.users_followup FOR UPDATE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "uf_delete" ON public.users_followup FOR DELETE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

-- ── TRAINERS ──
ALTER TABLE public.trainers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tr_select" ON public.trainers FOR SELECT TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "tr_insert" ON public.trainers FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "tr_update" ON public.trainers FOR UPDATE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "tr_delete" ON public.trainers FOR DELETE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

-- ── COURSES ──
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "co_select" ON public.courses FOR SELECT TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "co_insert" ON public.courses FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "co_update" ON public.courses FOR UPDATE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "co_delete" ON public.courses FOR DELETE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

-- ── QURAN_CIRCLES ──
ALTER TABLE public.quran_circles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qc_select" ON public.quran_circles FOR SELECT TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "qc_insert" ON public.quran_circles FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "qc_update" ON public.quran_circles FOR UPDATE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "qc_delete" ON public.quran_circles FOR DELETE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

-- ── CARAVANS ──
ALTER TABLE public.caravans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cv_select" ON public.caravans FOR SELECT TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "cv_insert" ON public.caravans FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "cv_update" ON public.caravans FOR UPDATE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "cv_delete" ON public.caravans FOR DELETE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

-- ── EVENTS ──
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ev_select" ON public.events FOR SELECT TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "ev_insert" ON public.events FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "ev_update" ON public.events FOR UPDATE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "ev_delete" ON public.events FOR DELETE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

-- ── COMMITTEES ──
ALTER TABLE public.committees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cm_select" ON public.committees FOR SELECT TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "cm_insert" ON public.committees FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "cm_update" ON public.committees FOR UPDATE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "cm_delete" ON public.committees FOR DELETE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

-- ── ACTIVITY_TYPES ──
ALTER TABLE public.activity_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "at_select" ON public.activity_types FOR SELECT TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "at_insert" ON public.activity_types FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "at_update" ON public.activity_types FOR UPDATE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "at_delete" ON public.activity_types FOR DELETE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

-- ── FINE_TYPES ──
ALTER TABLE public.fine_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ft_select" ON public.fine_types FOR SELECT TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "ft_insert" ON public.fine_types FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "ft_update" ON public.fine_types FOR UPDATE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "ft_delete" ON public.fine_types FOR DELETE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

-- ── BADGES ──
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bg_select" ON public.badges FOR SELECT TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "bg_insert" ON public.badges FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "bg_update" ON public.badges FOR UPDATE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "bg_delete" ON public.badges FOR DELETE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

-- ── VOLUNTEER_FEEDBACKS ──
ALTER TABLE public.volunteer_feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vfb_select" ON public.volunteer_feedbacks FOR SELECT TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "vfb_insert" ON public.volunteer_feedbacks FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "vfb_update" ON public.volunteer_feedbacks FOR UPDATE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "vfb_delete" ON public.volunteer_feedbacks FOR DELETE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

-- ── VOLUNTEER_FINES ──
ALTER TABLE public.volunteer_fines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vfi_select" ON public.volunteer_fines FOR SELECT TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "vfi_insert" ON public.volunteer_fines FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "vfi_update" ON public.volunteer_fines FOR UPDATE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "vfi_delete" ON public.volunteer_fines FOR DELETE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

-- ── INTERESTED_BENEFICIARIES ──
ALTER TABLE public.interested_beneficiaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ib_select" ON public.interested_beneficiaries FOR SELECT TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "ib_insert" ON public.interested_beneficiaries FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "ib_update" ON public.interested_beneficiaries FOR UPDATE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "ib_delete" ON public.interested_beneficiaries FOR DELETE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

-- ── GROUP_SUBMISSIONS ──
ALTER TABLE public.group_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gs_select" ON public.group_submissions FOR SELECT TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "gs_insert" ON public.group_submissions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "gs_update" ON public.group_submissions FOR UPDATE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "gs_delete" ON public.group_submissions FOR DELETE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

-- ── USER_BADGES ──
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ub_select" ON public.user_badges FOR SELECT TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "ub_insert" ON public.user_badges FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "ub_update" ON public.user_badges FOR UPDATE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "ub_delete" ON public.user_badges FOR DELETE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

-- ── QURAN_TEACHERS ──
ALTER TABLE public.quran_teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qt_select" ON public.quran_teachers FOR SELECT TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "qt_insert" ON public.quran_teachers FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "qt_update" ON public.quran_teachers FOR UPDATE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "qt_delete" ON public.quran_teachers FOR DELETE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

-- ── QURAN_BENEFICIARIES ──
ALTER TABLE public.quran_beneficiaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qb_select" ON public.quran_beneficiaries FOR SELECT TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "qb_insert" ON public.quran_beneficiaries FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "qb_update" ON public.quran_beneficiaries FOR UPDATE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

CREATE POLICY "qb_delete" ON public.quran_beneficiaries FOR DELETE TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

-- ────────────────────────────────────────────────────────────────────────────
-- 6. BRANCHES table — keep readable by all auth users
-- ────────────────────────────────────────────────────────────────────────────
-- (branches table policies were set in the original migration, keep them)
