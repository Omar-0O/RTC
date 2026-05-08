-- ============================================================================
-- MULTI-TENANT RLS VERIFICATION TESTS
-- Run these as a superuser to verify isolation is working correctly.
-- ============================================================================

-- ── TEST 1: Verify all business tables have branch_id ──────────────
DO $$
DECLARE
  tbl text;
  col_exists boolean;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'profiles','activity_submissions','users_followup','trainers',
    'courses','quran_circles','caravans','events','committees',
    'activity_types','fine_types','badges','volunteer_feedbacks',
    'volunteer_fines','interested_beneficiaries','group_submissions',
    'user_badges','quran_teachers','quran_beneficiaries'
  ]) LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'branch_id'
    ) INTO col_exists;

    IF NOT col_exists THEN
      RAISE EXCEPTION 'FAIL: Table % is missing branch_id column', tbl;
    END IF;
  END LOOP;

  RAISE NOTICE 'PASS: All business tables have branch_id column';
END;
$$;

-- ── TEST 2: Verify RLS is enabled on all business tables ───────────
DO $$
DECLARE
  tbl text;
  rls_enabled boolean;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'profiles','activity_submissions','users_followup','trainers',
    'courses','quran_circles','caravans','events','committees',
    'activity_types','fine_types','badges','volunteer_feedbacks',
    'volunteer_fines','interested_beneficiaries','group_submissions',
    'user_badges','quran_teachers','quran_beneficiaries'
  ]) LOOP
    SELECT relrowsecurity INTO rls_enabled
    FROM pg_class WHERE relname = tbl AND relnamespace = 'public'::regnamespace;

    IF NOT rls_enabled THEN
      RAISE EXCEPTION 'FAIL: RLS not enabled on table %', tbl;
    END IF;
  END LOOP;

  RAISE NOTICE 'PASS: RLS enabled on all business tables';
END;
$$;

-- ── TEST 3: Verify auto-inject triggers exist ──────────────────────
DO $$
DECLARE
  tbl text;
  trigger_exists boolean;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'activity_submissions','users_followup','trainers','courses',
    'quran_circles','caravans','events','committees','activity_types',
    'fine_types','badges','volunteer_feedbacks','volunteer_fines',
    'interested_beneficiaries','group_submissions','user_badges',
    'quran_teachers','quran_beneficiaries'
  ]) LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.triggers
      WHERE trigger_schema = 'public'
        AND event_object_table = tbl
        AND trigger_name = 'trg_auto_branch_' || tbl
    ) INTO trigger_exists;

    IF NOT trigger_exists THEN
      RAISE EXCEPTION 'FAIL: Auto-inject trigger missing on table %', tbl;
    END IF;
  END LOOP;

  RAISE NOTICE 'PASS: Auto-inject triggers exist on all tables';
END;
$$;

-- ── TEST 4: Verify indexes on branch_id ────────────────────────────
DO $$
DECLARE
  tbl text;
  idx_exists boolean;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'profiles','activity_submissions','users_followup','trainers',
    'courses','quran_circles','caravans','events','committees',
    'activity_types','fine_types','badges','volunteer_feedbacks',
    'volunteer_fines','interested_beneficiaries','group_submissions',
    'user_badges','quran_teachers','quran_beneficiaries'
  ]) LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = tbl
        AND indexname LIKE '%branch%'
    ) INTO idx_exists;

    IF NOT idx_exists THEN
      RAISE EXCEPTION 'FAIL: No branch_id index on table %', tbl;
    END IF;
  END LOOP;

  RAISE NOTICE 'PASS: branch_id indexes exist on all tables';
END;
$$;

-- ── TEST 5: Verify no NULL branch_id records ───────────────────────
DO $$
DECLARE
  tbl text;
  null_count integer;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'profiles','activity_submissions','users_followup','trainers',
    'courses','quran_circles','caravans','events','committees',
    'activity_types','fine_types','badges'
  ]) LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE branch_id IS NULL', tbl) INTO null_count;
    IF null_count > 0 THEN
      RAISE WARNING 'WARNING: % has % records with NULL branch_id', tbl, null_count;
    END IF;
  END LOOP;

  RAISE NOTICE 'DONE: NULL branch_id check complete';
END;
$$;

-- ── TEST 6: Verify helper functions exist ──────────────────────────
DO $$
BEGIN
  PERFORM proname FROM pg_proc
    WHERE proname = 'get_my_branch_id' AND pronamespace = 'public'::regnamespace;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL: get_my_branch_id() function not found';
  END IF;

  PERFORM proname FROM pg_proc
    WHERE proname = 'is_admin_or_exec' AND pronamespace = 'public'::regnamespace;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL: is_admin_or_exec() function not found';
  END IF;

  RAISE NOTICE 'PASS: Helper functions exist';
END;
$$;
