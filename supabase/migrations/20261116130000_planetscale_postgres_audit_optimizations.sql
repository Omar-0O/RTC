-- ============================================================================
-- PostgreSQL Database Audit & Optimization Migration
-- Applied using .agents/skills/postgres, write-safe-migrations,
-- debug-slow-queries, and data-quality-audit best practices:
--   A. Index optimization: remove redundant prefix index, add missing FK/composite indexes & ANALYZE
--   B. Trigger & data integrity fixes: restore manual volunteer levels, atomic deletion,
--      short-circuit badge checks, fast-path branch auto-injection
--   C. RPC correctness & performance: fix double point award on ethics calls, replace
--      correlated subqueries in monthly auto-dismissal, half-open intervals & CTE in leaderboard
--   D. RLS InitPlan optimization: scalar subquery caching & leadership role helper
--   E. Safe migration guards (lock_timeout/statement_timeout) & data quality verification
-- ============================================================================

BEGIN;

-- Safe migration lock/timeout guards (write-safe-migrations)
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ============================================================================
-- SECTION A: INDEX OPTIMIZATION
-- ============================================================================

-- 1. Drop redundant left-prefix index on profiles(is_active)
--    Covered by idx_profiles_auto_dismissal (is_active, auto_dismissal_enabled)
DROP INDEX IF EXISTS public.idx_profiles_is_active;

-- 2. activity_submissions: foreign keys & hot-path composite indexes
CREATE INDEX IF NOT EXISTS idx_activity_submissions_volunteer_status_submitted
  ON public.activity_submissions (volunteer_id, status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_submissions_committee_status_submitted
  ON public.activity_submissions (committee_id, status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_submissions_branch_status_submitted
  ON public.activity_submissions (branch_id, status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_submissions_trainer_activity_type
  ON public.activity_submissions (trainer_id, activity_type_id)
  WHERE trainer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_submissions_activity_type_id
  ON public.activity_submissions (activity_type_id);

CREATE INDEX IF NOT EXISTS idx_activity_submissions_group_submission_id
  ON public.activity_submissions (group_submission_id)
  WHERE group_submission_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_submissions_reviewed_by
  ON public.activity_submissions (reviewed_by)
  WHERE reviewed_by IS NOT NULL;

-- 3. profiles: committee foreign key & branch+active composite index
CREATE INDEX IF NOT EXISTS idx_profiles_committee_id
  ON public.profiles (committee_id)
  WHERE committee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_branch_active
  ON public.profiles (branch_id, is_active);

-- 4. volunteer_fines & volunteer_feedbacks: foreign key & unpaid lookup indexes
CREATE INDEX IF NOT EXISTS idx_volunteer_fines_volunteer_paid
  ON public.volunteer_fines (volunteer_id, is_paid);

CREATE INDEX IF NOT EXISTS idx_volunteer_feedbacks_volunteer_id
  ON public.volunteer_feedbacks (volunteer_id);

-- 5. courses & course sub-tables: foreign keys & room conflict lookup
CREATE INDEX IF NOT EXISTS idx_courses_committee_id
  ON public.courses (committee_id)
  WHERE committee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_courses_trainer_id
  ON public.courses (trainer_id)
  WHERE trainer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_courses_room_schedule
  ON public.courses (branch_id, room, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_course_lectures_course_number
  ON public.course_lectures (course_id, lecture_number);

CREATE INDEX IF NOT EXISTS idx_course_attendance_lecture_id
  ON public.course_attendance (lecture_id);

CREATE INDEX IF NOT EXISTS idx_course_organizers_course_id
  ON public.course_organizers (course_id);

CREATE INDEX IF NOT EXISTS idx_course_trainers_trainer_id
  ON public.course_trainers (trainer_id);

CREATE INDEX IF NOT EXISTS idx_trainer_lecture_records_lecture_id
  ON public.trainer_lecture_records (lecture_id);

CREATE INDEX IF NOT EXISTS idx_trainer_lecture_records_course_id
  ON public.trainer_lecture_records (course_id);

CREATE INDEX IF NOT EXISTS idx_trainer_lecture_records_volunteer_id
  ON public.trainer_lecture_records (volunteer_id)
  WHERE volunteer_id IS NOT NULL;

-- 6. trainers, caravan_participants, group_submissions: foreign key indexes
CREATE INDEX IF NOT EXISTS idx_trainers_committee_id
  ON public.trainers (committee_id)
  WHERE committee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trainers_user_id
  ON public.trainers (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_caravan_participants_caravan_id
  ON public.caravan_participants (caravan_id);

CREATE INDEX IF NOT EXISTS idx_caravan_participants_volunteer_id
  ON public.caravan_participants (volunteer_id)
  WHERE volunteer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_group_submissions_leader_id
  ON public.group_submissions (leader_id);

CREATE INDEX IF NOT EXISTS idx_group_submissions_committee_id
  ON public.group_submissions (committee_id)
  WHERE committee_id IS NOT NULL;

-- 7. Drop duplicate foreign key constraints & add remaining FK/source-tracking indexes
ALTER TABLE public.users_followup
  DROP CONSTRAINT IF EXISTS users_followup_linked_to_fkey;

ALTER TABLE public.quran_circle_sessions
  DROP CONSTRAINT IF EXISTS fk_session_circle;

CREATE INDEX IF NOT EXISTS idx_activity_submissions_source
  ON public.activity_submissions (source_type, source_id)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_submissions_fine_type_id
  ON public.activity_submissions (fine_type_id)
  WHERE fine_type_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_types_committee_id
  ON public.activity_types (committee_id)
  WHERE committee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_participants_event_id
  ON public.event_participants (event_id);

CREATE INDEX IF NOT EXISTS idx_event_participants_volunteer_id
  ON public.event_participants (volunteer_id)
  WHERE volunteer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ethics_calls_participants_call_id
  ON public.ethics_calls_participants (call_id);

CREATE INDEX IF NOT EXISTS idx_ethics_calls_participants_volunteer_id
  ON public.ethics_calls_participants (volunteer_id)
  WHERE volunteer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_competition_entries_participant_id
  ON public.competition_entries (participant_id);

CREATE INDEX IF NOT EXISTS idx_quran_circles_teacher_id
  ON public.quran_circles (teacher_id)
  WHERE teacher_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quran_circles_organizer_id
  ON public.quran_circles (organizer_id)
  WHERE organizer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quran_circle_beneficiaries_beneficiary_id
  ON public.quran_circle_beneficiaries (beneficiary_id);

CREATE INDEX IF NOT EXISTS idx_quran_progress_history_beneficiary_id
  ON public.quran_progress_history (beneficiary_id);

CREATE INDEX IF NOT EXISTS idx_quran_teachers_user_id
  ON public.quran_teachers (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id
  ON public.user_badges (badge_id);

CREATE INDEX IF NOT EXISTS idx_users_followup_linked_to
  ON public.users_followup (linked_to)
  WHERE linked_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_volunteer_feedbacks_author_id
  ON public.volunteer_feedbacks (author_id);

CREATE INDEX IF NOT EXISTS idx_volunteer_fines_fine_type_id
  ON public.volunteer_fines (fine_type_id);

CREATE INDEX IF NOT EXISTS idx_volunteer_fines_created_by
  ON public.volunteer_fines (created_by)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rooms_branch_id
  ON public.rooms (branch_id)
  WHERE branch_id IS NOT NULL;

-- 8. Refresh planner statistics on newly indexed tables (debug-slow-queries)
ANALYZE public.activity_submissions;
ANALYZE public.profiles;
ANALYZE public.volunteer_fines;
ANALYZE public.volunteer_feedbacks;
ANALYZE public.courses;
ANALYZE public.course_lectures;
ANALYZE public.course_attendance;
ANALYZE public.course_organizers;
ANALYZE public.course_trainers;
ANALYZE public.trainer_lecture_records;
ANALYZE public.trainers;
ANALYZE public.caravan_participants;
ANALYZE public.group_submissions;
ANALYZE public.event_participants;
ANALYZE public.ethics_calls_participants;
ANALYZE public.competition_entries;
ANALYZE public.quran_circles;
ANALYZE public.quran_circle_beneficiaries;
ANALYZE public.quran_progress_history;
ANALYZE public.quran_teachers;
ANALYZE public.user_badges;
ANALYZE public.users_followup;
ANALYZE public.rooms;
ANALYZE public.activity_types;


-- ============================================================================
-- SECTION B: TRIGGER & DATA INTEGRITY FIXES
-- ============================================================================

-- 1. Fix update_user_points_on_approval():
--    - Do NOT overwrite manually managed volunteer_level via calculate_level()
--      (fixes regression introduced by 20260131000002_fix_fine_trigger.sql)
--    - Guard against NULL volunteer_id (guest or external-trainer submissions)
CREATE OR REPLACE FUNCTION public.update_user_points_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.fine_type_id IS NOT NULL OR NEW.volunteer_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF (TG_OP = 'INSERT' AND NEW.status = 'approved')
     OR (TG_OP = 'UPDATE' AND NEW.status = 'approved' AND COALESCE(OLD.status::text, '') <> 'approved') THEN
    UPDATE public.profiles
    SET
      total_points = COALESCE(total_points, 0) + COALESCE(NEW.points_awarded, 0),
      activities_count = COALESCE(activities_count, 0) + 1
    WHERE id = NEW.volunteer_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Fix deduct_points_on_submission_delete():
--    - Replace non-atomic SELECT + UPDATE with a single atomic UPDATE
--    - Guard against NULL volunteer_id and fine records
CREATE OR REPLACE FUNCTION public.deduct_points_on_submission_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status = 'approved'
     AND OLD.volunteer_id IS NOT NULL
     AND OLD.fine_type_id IS NULL THEN
    UPDATE public.profiles
    SET
      total_points = GREATEST(0, COALESCE(total_points, 0) - COALESCE(OLD.points_awarded, 0)),
      activities_count = GREATEST(0, COALESCE(activities_count, 0) - 1)
    WHERE id = OLD.volunteer_id;
  END IF;

  RETURN OLD;
END;
$$;

-- 3. Optimize auto_award_badges():
--    - Short-circuit immediately when no auto_award badges exist
--    - Only query activity_submissions for caravan count when a badge requires caravans_required
CREATE OR REPLACE FUNCTION public.auto_award_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  badge_record RECORD;
  user_caravans_count INTEGER := 0;
  user_months_active INTEGER := 0;
  needs_caravans BOOLEAN := false;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.badges WHERE auto_award = true) THEN
    RETURN NEW;
  END IF;

  SELECT EXTRACT(year FROM age(now(), NEW.created_at)) * 12 + EXTRACT(month FROM age(now(), NEW.created_at))
  INTO user_months_active;

  SELECT EXISTS (
    SELECT 1
    FROM public.badges
    WHERE auto_award = true
      AND caravans_required IS NOT NULL
  ) INTO needs_caravans;

  IF needs_caravans THEN
    SELECT COUNT(*)
    INTO user_caravans_count
    FROM public.activity_submissions AS sub
    JOIN public.activity_types AS type ON sub.activity_type_id = type.id
    WHERE sub.volunteer_id = NEW.id
      AND sub.status = 'approved'
      AND (type.name ILIKE '%Caravan%' OR type.name_ar ILIKE '%قافلة%');
  END IF;

  FOR badge_record IN
    SELECT id, points_required, activities_required, months_required, caravans_required
    FROM public.badges
    WHERE auto_award = true
  LOOP
    IF (badge_record.points_required IS NULL OR NEW.total_points >= badge_record.points_required)
       AND (badge_record.activities_required IS NULL OR NEW.activities_count >= badge_record.activities_required)
       AND (badge_record.months_required IS NULL OR user_months_active >= badge_record.months_required)
       AND (badge_record.caravans_required IS NULL OR user_caravans_count >= badge_record.caravans_required)
    THEN
      INSERT INTO public.user_badges (user_id, badge_id, branch_id)
      VALUES (NEW.id, badge_record.id, NEW.branch_id)
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- 4. Optimize auto_set_branch_id():
--    - Fast-path return when explicit branch_id is supplied from nested trigger or system/cron context
--    - Combine caller profile & admin role lookup into a single query
CREATE OR REPLACE FUNCTION public.auto_set_branch_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  _user_branch uuid;
  _is_admin boolean := false;
BEGIN
  IF NEW.branch_id IS NOT NULL AND (pg_trigger_depth() > 1 OR v_uid IS NULL) THEN
    RETURN NEW;
  END IF;

  IF v_uid IS NULL THEN
    NEW.branch_id := get_default_branch_id();
    RETURN NEW;
  END IF;

  SELECT
    p.branch_id,
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = v_uid
        AND ur.role::text IN ('admin', 'executive')
    )
  INTO _user_branch, _is_admin
  FROM public.profiles p
  WHERE p.id = v_uid;

  IF NOT FOUND THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = v_uid
        AND ur.role::text IN ('admin', 'executive')
    ) INTO _is_admin;
  END IF;

  IF _is_admin AND NEW.branch_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  NEW.branch_id := COALESCE(_user_branch, get_default_branch_id());
  RETURN NEW;
END;
$$;

-- 5. Harden Quran session triggers with explicit search_path & branch propagation
CREATE OR REPLACE FUNCTION public.log_quran_session_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_quran_committee_id UUID;
  v_activity_type_id UUID;
  v_activity_points INTEGER;
  v_teacher_name TEXT;
  v_teacher_id UUID;
  v_teacher_phone TEXT;
  v_branch_id UUID;
BEGIN
  SELECT c.teacher_id, COALESCE(c.branch_id, public.get_default_branch_id()), t.name, t.phone
  INTO v_teacher_id, v_branch_id, v_teacher_name, v_teacher_phone
  FROM public.quran_circles c
  LEFT JOIN public.quran_teachers t ON c.teacher_id = t.id
  WHERE c.id = NEW.circle_id;

  SELECT id INTO v_quran_committee_id
  FROM public.committees
  WHERE name_ar ILIKE '%أهل القرآن%'
     OR name_ar ILIKE '%اهل القران%'
     OR name ILIKE '%Ahl Al-Quran%'
     OR name ILIKE '%Quran%'
  ORDER BY
    CASE WHEN branch_id IS NOT DISTINCT FROM v_branch_id THEN 0 ELSE 1 END,
    CASE WHEN name_ar ILIKE '%أهل%' THEN 1 ELSE 2 END
  LIMIT 1;

  SELECT id, COALESCE(points, 5) INTO v_activity_type_id, v_activity_points
  FROM public.activity_types
  WHERE name = 'Quran Circle Session'
     OR name_ar = 'جلسة حلقة قرآن'
     OR name_ar = 'حلقة قرآن'
     OR name ILIKE '%Quran Circle%'
  ORDER BY
    CASE WHEN branch_id IS NOT DISTINCT FROM v_branch_id THEN 0 ELSE 1 END,
    CASE WHEN name = 'Quran Circle Session' THEN 1 ELSE 2 END
  LIMIT 1;

  IF v_teacher_id IS NOT NULL
     AND v_quran_committee_id IS NOT NULL
     AND v_activity_type_id IS NOT NULL THEN

    INSERT INTO public.trainers (id, name_en, name_ar, phone, branch_id, updated_at)
    VALUES (v_teacher_id, v_teacher_name, v_teacher_name, COALESCE(v_teacher_phone, ''), v_branch_id, NOW())
    ON CONFLICT (id) DO UPDATE SET
      name_en = EXCLUDED.name_en,
      name_ar = EXCLUDED.name_ar,
      phone = EXCLUDED.phone,
      branch_id = COALESCE(public.trainers.branch_id, EXCLUDED.branch_id),
      updated_at = NOW();

    INSERT INTO public.activity_submissions (
      trainer_id,
      guest_name,
      guest_phone,
      participant_type,
      committee_id,
      activity_type_id,
      branch_id,
      description,
      points_awarded,
      status,
      submitted_at,
      source_type,
      source_id
    ) VALUES (
      v_teacher_id,
      v_teacher_name,
      v_teacher_phone,
      'trainer',
      v_quran_committee_id,
      v_activity_type_id,
      v_branch_id,
      'جلسة حلقة: ' || COALESCE(v_teacher_name, 'محفظ'),
      v_activity_points,
      'approved',
      NEW.session_date,
      'quran_session',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_quran_session_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.activity_submissions
  WHERE source_type = 'quran_session'
    AND source_id = OLD.id;
  RETURN OLD;
END;
$$;

-- 6. Harden get_trainer_stats(UUID) with search_path & multi-trainer support
CREATE OR REPLACE FUNCTION public.get_trainer_stats(p_trainer_id UUID)
RETURNS TABLE (
  courses_count INTEGER,
  certificates_delivered_count INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    COUNT(DISTINCT c.id)::INTEGER AS courses_count,
    COUNT(cb.id) FILTER (
      WHERE c.has_certificates = true
        AND c.certificate_status = 'delivered'
    )::INTEGER AS certificates_delivered_count
  FROM public.courses c
  LEFT JOIN public.course_beneficiaries cb ON cb.course_id = c.id
  WHERE c.trainer_id = p_trainer_id
     OR EXISTS (
       SELECT 1
       FROM public.course_trainers ct
       WHERE ct.course_id = c.id
         AND ct.trainer_id = p_trainer_id
     );
$$;

REVOKE ALL ON FUNCTION public.get_trainer_stats(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_trainer_stats(UUID) TO authenticated;


-- ============================================================================
-- SECTION C: RPC PERFORMANCE & CORRECTNESS OPTIMIZATION
-- ============================================================================

-- 1. Fix award_ethics_call_points(jsonb):
--    Remove redundant manual UPDATE on public.profiles (points are already incremented
--    atomically by the on_submission_approved AFTER INSERT trigger).
CREATE OR REPLACE FUNCTION public.award_ethics_call_points(participants jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $hardening$
DECLARE
  requester_id uuid := auth.uid();
  requester_branch uuid;
  is_global_admin boolean;
  participant jsonb;
  volunteer_id uuid;
  activity_type_id uuid;
  committee_id uuid;
  volunteer_branch uuid;
  activity_type_branch uuid;
  activity_type_committee uuid;
  points_to_award integer;
  wore_vest boolean;
  submitted_at timestamptz;
  description text;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT profile.branch_id
  INTO requester_branch
  FROM public.profiles profile
  WHERE profile.id = requester_id;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = requester_id
      AND role::text IN ('admin', 'executive')
  )
  INTO is_global_admin;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = requester_id
      AND role::text IN ('admin', 'executive', 'supervisor', 'head_ethics')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF NOT is_global_admin AND requester_branch IS NULL THEN
    RAISE EXCEPTION 'Requester branch is required';
  END IF;

  IF jsonb_typeof(participants) IS DISTINCT FROM 'array'
    OR jsonb_array_length(participants) = 0
    OR jsonb_array_length(participants) > 500 THEN
    RAISE EXCEPTION 'Invalid participants payload';
  END IF;

  FOR participant IN SELECT value FROM jsonb_array_elements(participants)
  LOOP
    IF jsonb_typeof(participant) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Invalid participant record';
    END IF;

    volunteer_id := NULLIF(participant->>'volunteer_id', '')::uuid;
    activity_type_id := NULLIF(participant->>'activity_type_id', '')::uuid;
    committee_id := NULLIF(participant->>'committee_id', '')::uuid;
    wore_vest := COALESCE((participant->>'wore_vest')::boolean, false);
    submitted_at := COALESCE(NULLIF(participant->>'submitted_at', '')::timestamptz, now());
    description := NULLIF(btrim(COALESCE(participant->>'description', '')), '');

    IF volunteer_id IS NULL OR activity_type_id IS NULL OR committee_id IS NULL THEN
      RAISE EXCEPTION 'Participant, activity type, and committee are required';
    END IF;

    SELECT profile.branch_id
    INTO volunteer_branch
    FROM public.profiles profile
    WHERE profile.id = volunteer_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Volunteer profile not found';
    END IF;

    SELECT
      activity_type.branch_id,
      activity_type.committee_id,
      COALESCE(
        CASE WHEN wore_vest THEN activity_type.points_with_vest ELSE activity_type.points_without_vest END,
        activity_type.points
      )
    INTO activity_type_branch, activity_type_committee, points_to_award
    FROM public.activity_types activity_type
    WHERE activity_type.id = activity_type_id;

    IF NOT FOUND OR activity_type_committee IS DISTINCT FROM committee_id OR points_to_award IS NULL THEN
      RAISE EXCEPTION 'Invalid ethics activity type';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.committees committee
      WHERE committee.id = committee_id
        AND committee.branch_id IS NOT DISTINCT FROM activity_type_branch
    ) THEN
      RAISE EXCEPTION 'Activity type committee does not match its branch';
    END IF;

    IF NOT is_global_admin
      AND (
        volunteer_branch IS DISTINCT FROM requester_branch
        OR activity_type_branch IS DISTINCT FROM requester_branch
      ) THEN
      RAISE EXCEPTION 'Cross-branch ethics point awards are forbidden';
    END IF;

    INSERT INTO public.activity_submissions (
      volunteer_id,
      activity_type_id,
      committee_id,
      status,
      points_awarded,
      submitted_at,
      description,
      wore_vest,
      branch_id
    ) VALUES (
      volunteer_id,
      activity_type_id,
      committee_id,
      'approved'::public.submission_status,
      points_to_award,
      submitted_at,
      COALESCE(description, 'Ethics call participation'),
      wore_vest,
      volunteer_branch
    );
  END LOOP;
END;
$hardening$;

REVOKE ALL ON FUNCTION public.award_ethics_call_points(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_ethics_call_points(jsonb) TO authenticated;

-- 2. Optimize run_monthly_auto_dismissal(BOOLEAN):
--    Replace per-row correlated subqueries with pre-aggregated CTEs + LEFT JOINs
CREATE OR REPLACE FUNCTION public.run_monthly_auto_dismissal(
  p_force BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_current_ym TEXT := to_char(v_now AT TIME ZONE 'Africa/Cairo', 'YYYY-MM');
  v_curr_month_start TIMESTAMPTZ := (date_trunc('month', v_now AT TIME ZONE 'Africa/Cairo')) AT TIME ZONE 'Africa/Cairo';
  v_prev_month_start TIMESTAMPTZ := (date_trunc('month', v_now AT TIME ZONE 'Africa/Cairo') - interval '1 month') AT TIME ZONE 'Africa/Cairo';
  v_dismissed_count INTEGER := 0;
BEGIN
  IF NOT p_force AND EXISTS (
    SELECT 1 FROM public.monthly_auto_dismissal_runs WHERE year_month = v_current_ym
  ) THEN
    RETURN jsonb_build_object(
      'already_ran', true,
      'year_month', v_current_ym
    );
  END IF;

  WITH approved_counts AS (
    SELECT
      s.volunteer_id,
      COUNT(*) AS approved_count
    FROM public.activity_submissions s
    WHERE s.status = 'approved'
      AND s.volunteer_id IS NOT NULL
      AND s.submitted_at >= v_prev_month_start
      AND s.submitted_at < v_curr_month_start
    GROUP BY s.volunteer_id
  ),
  unpaid_fines AS (
    SELECT DISTINCT vf.volunteer_id
    FROM public.volunteer_fines vf
    WHERE COALESCE(vf.is_paid, false) = false
  ),
  volunteer_eval AS (
    SELECT
      p.id,
      CASE
        WHEN lower(COALESCE(p.level::text, '')) IN ('project_responsible', 'gold', 'responsible', 'platinum', 'diamond') THEN 8
        ELSE 4
      END AS required_target,
      COALESCE(ac.approved_count, 0) AS approved_count,
      (uf.volunteer_id IS NOT NULL) AS has_unpaid_fine
    FROM public.profiles p
    LEFT JOIN approved_counts ac ON ac.volunteer_id = p.id
    LEFT JOIN unpaid_fines uf ON uf.volunteer_id = p.id
    WHERE p.is_active = true
      AND p.auto_dismissal_enabled = true
      AND lower(COALESCE(p.email, '')) NOT IN ('medaniparticipations@rtc.org', 'kiosk@rtc.internal')
      AND COALESCE(p.join_date::timestamptz, p.created_at) < v_curr_month_start
      AND NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = p.id
          AND ur.role::text IN ('admin', 'executive')
      )
  ),
  to_dismiss AS (
    SELECT
      ve.id,
      CASE
        WHEN ve.approved_count < ve.required_target AND ve.has_unpaid_fine THEN 'target_and_fine'
        WHEN ve.approved_count < ve.required_target THEN 'target_not_met'
        ELSE 'unpaid_fine'
      END AS reason
    FROM volunteer_eval ve
    WHERE ve.approved_count < ve.required_target
       OR ve.has_unpaid_fine = true
  ),
  updated AS (
    UPDATE public.profiles p
    SET
      is_active = false,
      dismissal_reason = td.reason,
      dismissed_at = v_now,
      updated_at = v_now
    FROM to_dismiss td
    WHERE p.id = td.id
    RETURNING p.id
  )
  SELECT COUNT(*) INTO v_dismissed_count FROM updated;

  INSERT INTO public.monthly_auto_dismissal_runs (year_month, executed_at, dismissed_count)
  VALUES (v_current_ym, v_now, v_dismissed_count)
  ON CONFLICT (year_month) DO UPDATE SET
    executed_at = EXCLUDED.executed_at,
    dismissed_count = EXCLUDED.dismissed_count;

  RETURN jsonb_build_object(
    'already_ran', false,
    'year_month', v_current_ym,
    'dismissed_count', v_dismissed_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_monthly_auto_dismissal(BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_monthly_auto_dismissal(BOOLEAN) TO service_role;

-- 3. Optimize get_leaderboard(TEXT, TIMESTAMPTZ, UUID):
--    - Use half-open date intervals [start_date, end_date_exclusive) instead of - interval '1 second'
--    - Pre-aggregate activity_submissions in a CTE before joining profiles & committees
CREATE OR REPLACE FUNCTION public.get_leaderboard(
  period_type TEXT,
  target_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  committee_filter UUID DEFAULT NULL
)
RETURNS TABLE (
  volunteer_id UUID,
  full_name TEXT,
  full_name_ar TEXT,
  avatar_url TEXT,
  total_points BIGINT,
  activities_count BIGINT,
  level public.volunteer_level,
  committee_id UUID,
  committee_name TEXT,
  committee_name_ar TEXT
)
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  start_date TIMESTAMP WITH TIME ZONE;
  end_date_exclusive TIMESTAMP WITH TIME ZONE;
  current_month INTEGER;
BEGIN
  current_month := date_part('month', target_date);

  IF period_type = 'month' THEN
    start_date := date_trunc('month', target_date);
    end_date_exclusive := start_date + interval '1 month';
  ELSIF period_type = 'quarter' THEN
    start_date := date_trunc('quarter', target_date);
    end_date_exclusive := start_date + interval '3 months';
  ELSIF period_type = 'third_year' THEN
    IF current_month >= 9 THEN
      start_date := date_trunc('year', target_date) + interval '8 months';
      end_date_exclusive := date_trunc('year', target_date) + interval '1 year';
    ELSIF current_month >= 5 THEN
      start_date := date_trunc('year', target_date) + interval '4 months';
      end_date_exclusive := date_trunc('year', target_date) + interval '8 months';
    ELSE
      start_date := date_trunc('year', target_date);
      end_date_exclusive := date_trunc('year', target_date) + interval '4 months';
    END IF;
  ELSIF period_type = 'half_year' THEN
    IF current_month <= 6 THEN
      start_date := date_trunc('year', target_date);
      end_date_exclusive := date_trunc('year', target_date) + interval '6 months';
    ELSE
      start_date := date_trunc('year', target_date) + interval '6 months';
      end_date_exclusive := date_trunc('year', target_date) + interval '1 year';
    END IF;
  ELSIF period_type = 'year' THEN
    start_date := date_trunc('year', target_date);
    end_date_exclusive := start_date + interval '1 year';
  ELSE
    start_date := NULL;
    end_date_exclusive := NULL;
  END IF;

  RETURN QUERY
  WITH submission_stats AS (
    SELECT
      s.volunteer_id AS sub_volunteer_id,
      COALESCE(SUM(s.points_awarded), 0)::BIGINT AS sum_points,
      COUNT(s.id)::BIGINT AS cnt_activities
    FROM public.activity_submissions s
    WHERE s.status = 'approved'
      AND s.volunteer_id IS NOT NULL
      AND (start_date IS NULL OR (s.submitted_at >= start_date AND s.submitted_at < end_date_exclusive))
    GROUP BY s.volunteer_id
  )
  SELECT
    p.id,
    p.full_name,
    p.full_name_ar,
    p.avatar_url,
    COALESCE(ss.sum_points, 0)::BIGINT,
    COALESCE(ss.cnt_activities, 0)::BIGINT,
    p.level,
    p.committee_id,
    c.name,
    c.name_ar
  FROM public.profiles p
  LEFT JOIN submission_stats ss ON ss.sub_volunteer_id = p.id
  LEFT JOIN public.committees c ON p.committee_id = c.id
  WHERE p.is_active = true
    AND (committee_filter IS NULL OR p.committee_id = committee_filter)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur_admin
      WHERE ur_admin.user_id = p.id AND ur_admin.role = 'admin'
    )
    AND (COALESCE(ss.sum_points, 0) > 0 OR period_type = 'all_time')
  ORDER BY
    COALESCE(ss.sum_points, 0) DESC,
    COALESCE(ss.cnt_activities, 0) DESC;
END;
$$;


-- ============================================================================
-- SECTION D: RLS POLICY INITPLAN OPTIMIZATION
-- ============================================================================

-- 1. Create STABLE SECURITY DEFINER helper for leadership role checks
CREATE OR REPLACE FUNCTION public.has_leadership_role()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = (SELECT auth.uid())
      AND role::text IN (
        'admin', 'executive', 'branch_admin', 'supervisor',
        'committee_leader', 'head_production', 'head_fourth_year',
        'head_events', 'head_caravans', 'head_ethics', 'head_quran',
        'head_marketing', 'head_ashbal', 'head_hr'
      )
  );
$$;

REVOKE ALL ON FUNCTION public.has_leadership_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_leadership_role() TO authenticated;

-- Also wrap auth.uid() in scalar subqueries inside existing branch/role helpers
CREATE OR REPLACE FUNCTION public.get_my_branch_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT branch_id FROM public.profiles WHERE id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_exec()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = (SELECT auth.uid()) AND role::text IN ('admin', 'executive')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_branch_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = (SELECT auth.uid())
      AND role::text IN (
        'branch_admin', 'head_hr', 'hr', 'supervisor',
        'committee_leader', 'head_marketing', 'head_quran',
        'head_production', 'head_fourth_year', 'head_events',
        'head_caravans', 'head_ethics', 'head_ashbal'
      )
  );
$$;

-- 2. Optimize public.profiles RLS policies with InitPlan scalar subqueries
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin_or_exec())
    OR branch_id = (SELECT public.get_my_branch_id())
    OR branch_id IS NULL
    OR lower(COALESCE((SELECT auth.jwt()) ->> 'email', '')) IN ('medaniparticipations@rtc.org', 'kiosk@rtc.internal')
  );

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.is_admin_or_exec())
    OR (
      (SELECT public.is_branch_manager())
      AND branch_id = (SELECT public.get_my_branch_id())
    )
  );

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_admin_or_exec())
    OR branch_id = (SELECT public.get_my_branch_id())
  );

-- 3. Optimize public.activity_submissions RLS policies with InitPlan scalar subqueries
DROP POLICY IF EXISTS "as_select" ON public.activity_submissions;
CREATE POLICY "as_select" ON public.activity_submissions
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin_or_exec())
    OR branch_id = (SELECT public.get_my_branch_id())
  );

DROP POLICY IF EXISTS "as_insert" ON public.activity_submissions;
CREATE POLICY "as_insert" ON public.activity_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_admin_or_exec())
    OR branch_id = (SELECT public.get_my_branch_id())
  );

DROP POLICY IF EXISTS "as_update" ON public.activity_submissions;
CREATE POLICY "as_update" ON public.activity_submissions
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.is_admin_or_exec())
    OR branch_id = (SELECT public.get_my_branch_id())
  );

DROP POLICY IF EXISTS "as_delete" ON public.activity_submissions;
CREATE POLICY "as_delete" ON public.activity_submissions
  FOR DELETE TO authenticated
  USING (
    (SELECT public.is_admin_or_exec())
    OR branch_id = (SELECT public.get_my_branch_id())
  );

-- 4. Optimize public.volunteer_fines RLS policies with InitPlan scalar subqueries
DROP POLICY IF EXISTS "vfi_select" ON public.volunteer_fines;
CREATE POLICY "vfi_select" ON public.volunteer_fines
  FOR SELECT TO authenticated
  USING (
    volunteer_id = (SELECT auth.uid())
    OR (SELECT public.is_admin_or_exec())
    OR branch_id = (SELECT public.get_my_branch_id())
  );

DROP POLICY IF EXISTS "vfi_insert" ON public.volunteer_fines;
CREATE POLICY "vfi_insert" ON public.volunteer_fines
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_admin_or_exec())
    OR branch_id = (SELECT public.get_my_branch_id())
  );

DROP POLICY IF EXISTS "vfi_update" ON public.volunteer_fines;
CREATE POLICY "vfi_update" ON public.volunteer_fines
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.is_admin_or_exec())
    OR branch_id = (SELECT public.get_my_branch_id())
  );

DROP POLICY IF EXISTS "vfi_delete" ON public.volunteer_fines;
CREATE POLICY "vfi_delete" ON public.volunteer_fines
  FOR DELETE TO authenticated
  USING (
    (SELECT public.is_admin_or_exec())
    OR branch_id = (SELECT public.get_my_branch_id())
  );

DROP POLICY IF EXISTS "Privileged users can view all fines" ON public.volunteer_fines;
CREATE POLICY "Privileged users can view all fines" ON public.volunteer_fines
  FOR SELECT TO authenticated
  USING (
    (SELECT public.has_leadership_role())
    OR volunteer_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "Privileged users can create fines" ON public.volunteer_fines;
CREATE POLICY "Privileged users can create fines" ON public.volunteer_fines
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_leadership_role()));

DROP POLICY IF EXISTS "Privileged users can update fines" ON public.volunteer_fines;
CREATE POLICY "Privileged users can update fines" ON public.volunteer_fines
  FOR UPDATE TO authenticated
  USING ((SELECT public.has_leadership_role()));

DROP POLICY IF EXISTS "Privileged users can delete fines" ON public.volunteer_fines;
CREATE POLICY "Privileged users can delete fines" ON public.volunteer_fines
  FOR DELETE TO authenticated
  USING ((SELECT public.has_leadership_role()));

-- 5. Fix column-shadowing bug & InitPlan in Quran circle management RLS policies
DROP POLICY IF EXISTS quran_enrollments_manage ON public.quran_enrollments;
CREATE POLICY quran_enrollments_manage ON public.quran_enrollments
  FOR ALL TO authenticated
  USING (
    (SELECT public.is_admin_or_exec())
    OR (
      public.has_role((SELECT auth.uid()), 'head_quran')
      AND EXISTS (
        SELECT 1 FROM public.quran_circles c
        WHERE c.id = public.quran_enrollments.circle_id
          AND c.branch_id = (SELECT public.get_my_branch_id())
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.quran_circle_organizers o
      JOIN public.quran_circles c ON c.id = o.circle_id
      WHERE o.circle_id = public.quran_enrollments.circle_id
        AND o.volunteer_id = (SELECT auth.uid())
        AND c.branch_id = (SELECT public.get_my_branch_id())
    )
  )
  WITH CHECK (
    (SELECT public.is_admin_or_exec())
    OR (
      public.has_role((SELECT auth.uid()), 'head_quran')
      AND EXISTS (
        SELECT 1 FROM public.quran_circles c
        WHERE c.id = public.quran_enrollments.circle_id
          AND c.branch_id = (SELECT public.get_my_branch_id())
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.quran_circle_organizers o
      JOIN public.quran_circles c ON c.id = o.circle_id
      WHERE o.circle_id = public.quran_enrollments.circle_id
        AND o.volunteer_id = (SELECT auth.uid())
        AND c.branch_id = (SELECT public.get_my_branch_id())
    )
  );

DROP POLICY IF EXISTS quran_sessions_manage ON public.quran_circle_sessions;
CREATE POLICY quran_sessions_manage ON public.quran_circle_sessions
  FOR ALL TO authenticated
  USING (
    (SELECT public.is_admin_or_exec())
    OR (
      public.has_role((SELECT auth.uid()), 'head_quran')
      AND EXISTS (
        SELECT 1 FROM public.quran_circles c
        WHERE c.id = public.quran_circle_sessions.circle_id
          AND c.branch_id = (SELECT public.get_my_branch_id())
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.quran_circle_organizers o
      JOIN public.quran_circles c ON c.id = o.circle_id
      WHERE o.circle_id = public.quran_circle_sessions.circle_id
        AND o.volunteer_id = (SELECT auth.uid())
        AND c.branch_id = (SELECT public.get_my_branch_id())
    )
  )
  WITH CHECK (
    (SELECT public.is_admin_or_exec())
    OR (
      public.has_role((SELECT auth.uid()), 'head_quran')
      AND EXISTS (
        SELECT 1 FROM public.quran_circles c
        WHERE c.id = public.quran_circle_sessions.circle_id
          AND c.branch_id = (SELECT public.get_my_branch_id())
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.quran_circle_organizers o
      JOIN public.quran_circles c ON c.id = o.circle_id
      WHERE o.circle_id = public.quran_circle_sessions.circle_id
        AND o.volunteer_id = (SELECT auth.uid())
        AND c.branch_id = (SELECT public.get_my_branch_id())
    )
  );

DROP POLICY IF EXISTS quran_attendance_manage ON public.quran_circle_beneficiaries;
CREATE POLICY quran_attendance_manage ON public.quran_circle_beneficiaries
  FOR ALL TO authenticated
  USING (
    (SELECT public.is_admin_or_exec())
    OR (
      public.has_role((SELECT auth.uid()), 'head_quran')
      AND EXISTS (
        SELECT 1 FROM public.quran_circles c
        WHERE c.id = public.quran_circle_beneficiaries.circle_id
          AND c.branch_id = (SELECT public.get_my_branch_id())
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.quran_circle_organizers o
      JOIN public.quran_circles c ON c.id = o.circle_id
      WHERE o.circle_id = public.quran_circle_beneficiaries.circle_id
        AND o.volunteer_id = (SELECT auth.uid())
        AND c.branch_id = (SELECT public.get_my_branch_id())
    )
  )
  WITH CHECK (
    (SELECT public.is_admin_or_exec())
    OR (
      public.has_role((SELECT auth.uid()), 'head_quran')
      AND EXISTS (
        SELECT 1 FROM public.quran_circles c
        WHERE c.id = public.quran_circle_beneficiaries.circle_id
          AND c.branch_id = (SELECT public.get_my_branch_id())
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.quran_circle_organizers o
      JOIN public.quran_circles c ON c.id = o.circle_id
      WHERE o.circle_id = public.quran_circle_beneficiaries.circle_id
        AND o.volunteer_id = (SELECT auth.uid())
        AND c.branch_id = (SELECT public.get_my_branch_id())
    )
  );


-- ============================================================================
-- SECTION E: POST-MIGRATION VERIFICATION & DATA QUALITY AUDIT
-- ============================================================================

DO $$
DECLARE
  v_negative_profiles_count BIGINT := 0;
  v_negative_fines_count BIGINT := 0;
  v_negative_approved_pts_count BIGINT := 0;
  v_future_submissions_count BIGINT := 0;
  v_null_branch_profiles_count BIGINT := 0;
BEGIN
  -- 1. Verify structural invariants from this migration
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_profiles_is_active'
  ) THEN
    RAISE EXCEPTION 'Expected redundant index public.idx_profiles_is_active to be dropped';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'has_leadership_role' AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION 'Expected helper function public.has_leadership_role() to exist';
  END IF;

  -- 2. Non-destructive data quality audit checks (data-quality-audit)
  SELECT COUNT(*) INTO v_negative_profiles_count
  FROM public.profiles
  WHERE total_points < 0 OR activities_count < 0;

  IF v_negative_profiles_count > 0 THEN
    RAISE WARNING 'Data quality audit: % profile(s) have negative total_points or activities_count', v_negative_profiles_count;
  END IF;

  SELECT COUNT(*) INTO v_negative_fines_count
  FROM public.volunteer_fines
  WHERE amount < 0;

  IF v_negative_fines_count > 0 THEN
    RAISE WARNING 'Data quality audit: % volunteer_fines row(s) have negative amount', v_negative_fines_count;
  END IF;

  SELECT COUNT(*) INTO v_negative_approved_pts_count
  FROM public.activity_submissions
  WHERE status = 'approved'
    AND fine_type_id IS NULL
    AND COALESCE(points_awarded, 0) < 0;

  IF v_negative_approved_pts_count > 0 THEN
    RAISE WARNING 'Data quality audit: % approved activity_submissions row(s) have negative points_awarded', v_negative_approved_pts_count;
  END IF;

  SELECT COUNT(*) INTO v_future_submissions_count
  FROM public.activity_submissions
  WHERE submitted_at > now() + interval '1 day';

  IF v_future_submissions_count > 0 THEN
    RAISE WARNING 'Data quality audit: % activity_submissions row(s) have submitted_at > 1 day in the future', v_future_submissions_count;
  END IF;

  SELECT COUNT(*) INTO v_null_branch_profiles_count
  FROM public.profiles
  WHERE branch_id IS NULL
    AND lower(COALESCE(email, '')) NOT IN ('medaniparticipations@rtc.org', 'kiosk@rtc.internal');

  IF v_null_branch_profiles_count > 0 THEN
    RAISE WARNING 'Data quality audit: % non-kiosk profile(s) have NULL branch_id', v_null_branch_profiles_count;
  END IF;
END;
$$;

COMMIT;
