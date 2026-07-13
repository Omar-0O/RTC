-- Targeted hardening for privileged RPCs and public Storage buckets.
-- Public object URLs continue to work. These policies block object enumeration.

BEGIN;

-- Public buckets do not need broad SELECT policies to serve known public URLs.
-- Keep authenticated object operations working without permitting bucket listing.
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Trainers" ON storage.objects;
DROP POLICY IF EXISTS "course_posters_public_read" ON storage.objects;
DROP POLICY IF EXISTS "quran_circle_posters_public_read" ON storage.objects;

CREATE POLICY "avatars_object_operations"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars'
  AND storage.allow_any_operation(ARRAY['object.get_authenticated_info', 'object.get_authenticated'])
  AND (
    (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    OR EXISTS (
      SELECT 1
      FROM public.user_roles role_assignment
      WHERE role_assignment.user_id = (SELECT auth.uid())
        AND role_assignment.role::text IN ('admin', 'executive', 'branch_admin', 'head_hr', 'supervisor')
    )
  )
);

CREATE POLICY "course_posters_object_operations"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'course-posters'
  AND storage.allow_any_operation(ARRAY['object.get_authenticated_info', 'object.get_authenticated'])
);

CREATE POLICY "quran_circle_posters_object_operations"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'quran-circle-posters'
  AND storage.allow_any_operation(ARRAY['object.get_authenticated_info', 'object.get_authenticated'])
);

CREATE POLICY "trainer_images_object_operations"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'trainers'
  AND storage.allow_any_operation(ARRAY['object.get_authenticated_info', 'object.get_authenticated'])
  AND EXISTS (
    SELECT 1
    FROM public.user_roles role_assignment
    WHERE role_assignment.user_id = (SELECT auth.uid())
      AND role_assignment.role::text IN (
        'admin', 'executive', 'branch_admin', 'supervisor',
        'head_production', 'head_fourth_year', 'head_quran'
      )
  )
);

CREATE OR REPLACE FUNCTION public.award_ethics_call_points(participants jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

    UPDATE public.profiles
    SET total_points = COALESCE(total_points, 0) + points_to_award
    WHERE id = volunteer_id;
  END LOOP;
END;
$hardening$;

CREATE OR REPLACE FUNCTION public.renew_ashbal_target()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $hardening$
DECLARE
  requester_id uuid := auth.uid();
  requester_branch uuid;
  is_global_admin boolean;
  updated_count integer;
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

  IF NOT is_global_admin
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = requester_id
        AND role::text = 'head_ashbal'
    ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF NOT is_global_admin AND requester_branch IS NULL THEN
    RAISE EXCEPTION 'Requester branch is required';
  END IF;

  WITH updated_rows AS (
    UPDATE public.profiles
    SET ashbal_status = 'previous'
    WHERE is_ashbal = true
      AND ashbal_status = 'active'
      AND (is_global_admin OR branch_id = requester_branch)
    RETURNING 1
  )
  SELECT count(*) INTO updated_count FROM updated_rows;

  RETURN json_build_object(
    'success', true,
    'message', 'Target renewed successfully',
    'count', updated_count
  );
END;
$hardening$;

CREATE OR REPLACE FUNCTION public.check_room_conflict(
  p_room text,
  p_schedule_days text[],
  p_schedule_time time,
  p_schedule_end_time time,
  p_start_date date,
  p_end_date date,
  p_exclude_course_id uuid DEFAULT NULL
)
RETURNS TABLE (
  conflicting_course_name text,
  conflicting_committee_name text,
  conflicting_committee_name_ar text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $hardening$
DECLARE
  requester_id uuid := auth.uid();
  requester_branch uuid;
  is_global_admin boolean;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NULLIF(btrim(p_room), '') IS NULL
    OR p_schedule_time IS NULL
    OR p_start_date IS NULL
    OR COALESCE(array_length(p_schedule_days, 1), 0) = 0
    OR (p_end_date IS NOT NULL AND p_end_date < p_start_date) THEN
    RAISE EXCEPTION 'Invalid room conflict check';
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
      AND role::text IN (
        'admin', 'executive', 'supervisor', 'head_production',
        'head_fourth_year', 'head_events', 'head_caravans',
        'head_marketing', 'head_hr', 'committee_leader'
      )
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF NOT is_global_admin AND requester_branch IS NULL THEN
    RAISE EXCEPTION 'Requester branch is required';
  END IF;

  RETURN QUERY
  SELECT
    course.name::text,
    COALESCE(committee.name, '')::text,
    COALESCE(committee.name_ar, '')::text
  FROM public.courses course
  LEFT JOIN public.committees committee ON committee.id = course.committee_id
  WHERE course.room = p_room
    AND (p_exclude_course_id IS NULL OR course.id <> p_exclude_course_id)
    AND course.start_date <= COALESCE(p_end_date, '9999-12-31'::date)
    AND COALESCE(course.end_date, '9999-12-31'::date) >= p_start_date
    AND course.schedule_days && p_schedule_days
    AND course.schedule_time < COALESCE(p_schedule_end_time, p_schedule_time + interval '1 hour')
    AND COALESCE(course.schedule_end_time, course.schedule_time + interval '1 hour') > p_schedule_time
    AND (is_global_admin OR course.branch_id = requester_branch)
  LIMIT 1;
END;
$hardening$;

CREATE OR REPLACE FUNCTION public.get_committees_with_stats(
  p_start_date text DEFAULT NULL,
  p_end_date text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  name_ar text,
  description text,
  description_ar text,
  color text,
  committee_type text,
  volunteer_count bigint,
  trainer_count bigint,
  total_points bigint,
  participation_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $hardening$
DECLARE
  requester_id uuid := auth.uid();
  requester_branch uuid;
  is_global_admin boolean;
  start_at timestamptz;
  end_at timestamptz;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  start_at := NULLIF(p_start_date, '')::timestamptz;
  end_at := NULLIF(p_end_date, '')::timestamptz;

  IF start_at IS NOT NULL AND end_at IS NOT NULL AND start_at > end_at THEN
    RAISE EXCEPTION 'Invalid date range';
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

  IF NOT is_global_admin
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = requester_id
        AND role::text IN ('supervisor', 'branch_admin', 'head_hr')
    ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF NOT is_global_admin AND requester_branch IS NULL THEN
    RAISE EXCEPTION 'Requester branch is required';
  END IF;

  RETURN QUERY
  WITH volunteer_counts AS (
    SELECT profile.committee_id, count(*) AS count
    FROM public.profiles profile
    WHERE profile.committee_id IS NOT NULL
      AND (is_global_admin OR profile.branch_id = requester_branch)
    GROUP BY profile.committee_id
  ),
  trainer_counts AS (
    SELECT trainer.committee_id, count(*) AS count
    FROM public.trainers trainer
    WHERE trainer.committee_id IS NOT NULL
      AND (is_global_admin OR trainer.branch_id = requester_branch)
    GROUP BY trainer.committee_id
  ),
  activity_stats AS (
    SELECT submission.committee_id,
      count(*) AS participation_count,
      COALESCE(sum(submission.points_awarded), 0) AS points_total
    FROM public.activity_submissions submission
    WHERE submission.committee_id IS NOT NULL
      AND submission.status = 'approved'
      AND (start_at IS NULL OR submission.submitted_at >= start_at)
      AND (end_at IS NULL OR submission.submitted_at <= end_at)
      AND (is_global_admin OR submission.branch_id = requester_branch)
    GROUP BY submission.committee_id
  )
  SELECT
    committee.id,
    committee.name,
    committee.name_ar,
    committee.description,
    committee.description_ar,
    committee.color,
    committee.committee_type,
    COALESCE(volunteer_counts.count, 0),
    COALESCE(trainer_counts.count, 0),
    COALESCE(activity_stats.points_total, 0)::bigint,
    COALESCE(activity_stats.participation_count, 0)
  FROM public.committees committee
  LEFT JOIN volunteer_counts ON committee.id = volunteer_counts.committee_id
  LEFT JOIN trainer_counts ON committee.id = trainer_counts.committee_id
  LEFT JOIN activity_stats ON committee.id = activity_stats.committee_id
  WHERE is_global_admin OR committee.branch_id = requester_branch
  ORDER BY committee.name;
END;
$hardening$;

REVOKE ALL ON FUNCTION public.award_ethics_call_points(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.renew_ashbal_target() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_room_conflict(text, text[], time, time, date, date, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_committees_with_stats(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.award_ethics_call_points(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.renew_ashbal_target() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_room_conflict(text, text[], time, time, date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_committees_with_stats(text, text) TO authenticated;

COMMIT;
