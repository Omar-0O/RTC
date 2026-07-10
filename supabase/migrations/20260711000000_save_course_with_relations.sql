-- Atomic course create/update. Apply to local Supabase before testing course create/edit.
CREATE OR REPLACE FUNCTION public.save_course_with_relations(
  p_course_id UUID,
  p_course JSONB,
  p_organizers JSONB DEFAULT '[]'::JSONB,
  p_marketers JSONB DEFAULT '[]'::JSONB,
  p_trainer_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_lecture_dates DATE[] DEFAULT ARRAY[]::DATE[],
  p_ad_dates DATE[] DEFAULT ARRAY[]::DATE[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_requester_id UUID := auth.uid();
  v_requester_branch UUID;
  v_requester_committee UUID;
  v_course_branch UUID;
  v_course_committee UUID;
  v_course_id UUID;
  v_existing_lecture_id UUID;
  v_kept_lecture_ids UUID[] := ARRAY[]::UUID[];
  v_index INTEGER;
  v_total_lectures INTEGER;
  v_is_global_admin BOOLEAN;
  v_has_privileged_course_role BOOLEAN;
  v_is_committee_leader_only BOOLEAN;
BEGIN
  IF v_requester_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF jsonb_typeof(p_course) IS DISTINCT FROM 'object'
    OR jsonb_typeof(COALESCE(p_organizers, '[]'::JSONB)) IS DISTINCT FROM 'array'
    OR jsonb_typeof(COALESCE(p_marketers, '[]'::JSONB)) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid course payload';
  END IF;

  SELECT branch_id, committee_id
  INTO v_requester_branch, v_requester_committee
  FROM public.profiles
  WHERE id = v_requester_id;

  SELECT
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = v_requester_id AND role::text IN ('admin', 'executive')
    ),
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = v_requester_id
        AND role::text IN (
          'admin', 'executive', 'supervisor', 'head_production',
          'head_fourth_year', 'head_events', 'head_caravans',
          'head_marketing', 'head_hr', 'committee_leader'
        )
    ),
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = v_requester_id AND role::text = 'committee_leader'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = v_requester_id
        AND role::text IN (
          'admin', 'executive', 'supervisor', 'head_production',
          'head_fourth_year', 'head_events', 'head_caravans',
          'head_marketing', 'head_hr'
        )
    )
  INTO v_is_global_admin, v_has_privileged_course_role, v_is_committee_leader_only;

  IF NOT v_has_privileged_course_role THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  v_total_lectures := NULLIF(p_course->>'total_lectures', '')::INTEGER;
  IF COALESCE(p_course->>'name', '') = ''
    OR COALESCE(p_course->>'room', '') = ''
    OR COALESCE(p_course->'schedule_days', '[]'::JSONB) = '[]'::JSONB
    OR v_total_lectures IS NULL
    OR v_total_lectures < 1
    OR COALESCE(array_length(p_lecture_dates, 1), 0) <> v_total_lectures THEN
    RAISE EXCEPTION 'Invalid course schedule';
  END IF;

  IF p_course_id IS NULL THEN
    v_course_branch := NULLIF(p_course->>'branch_id', '')::UUID;
    v_course_committee := NULLIF(p_course->>'committee_id', '')::UUID;

    IF v_course_branch IS NULL THEN
      v_course_branch := v_requester_branch;
    END IF;
  ELSE
    SELECT branch_id, committee_id
    INTO v_course_branch, v_course_committee
    FROM public.courses
    WHERE id = p_course_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Course not found';
    END IF;

    IF NULLIF(p_course->>'branch_id', '') IS NOT NULL
      AND NULLIF(p_course->>'branch_id', '')::UUID <> v_course_branch THEN
      RAISE EXCEPTION 'Course branch cannot be changed';
    END IF;

    v_course_committee := COALESCE(NULLIF(p_course->>'committee_id', '')::UUID, v_course_committee);
  END IF;

  IF NOT v_is_global_admin THEN
    IF v_requester_branch IS NULL OR v_course_branch IS DISTINCT FROM v_requester_branch THEN
      RAISE EXCEPTION 'Cross-branch course management is forbidden';
    END IF;

    IF v_is_committee_leader_only
      AND (v_requester_committee IS NULL OR v_course_committee IS DISTINCT FROM v_requester_committee) THEN
      RAISE EXCEPTION 'Committee leaders may only manage their own committee courses';
    END IF;
  END IF;

  IF v_course_committee IS NULL THEN
    RAISE EXCEPTION 'Course committee is required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_organizers) AS organizer(volunteer_id UUID, name TEXT, phone TEXT)
    LEFT JOIN public.profiles profile ON profile.id = organizer.volunteer_id
    WHERE organizer.name IS NULL OR btrim(organizer.name) = ''
      OR (organizer.volunteer_id IS NOT NULL AND profile.branch_id IS DISTINCT FROM v_course_branch)
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_marketers) AS marketer(volunteer_id UUID, name TEXT, phone TEXT)
    LEFT JOIN public.profiles profile ON profile.id = marketer.volunteer_id
    WHERE marketer.name IS NULL OR btrim(marketer.name) = ''
      OR (marketer.volunteer_id IS NOT NULL AND profile.branch_id IS DISTINCT FROM v_course_branch)
  ) OR EXISTS (
    SELECT 1
    FROM public.trainers trainer
    WHERE trainer.id = ANY(p_trainer_ids)
      AND trainer.branch_id IS DISTINCT FROM v_course_branch
  ) THEN
    RAISE EXCEPTION 'Course relations must belong to the course branch';
  END IF;

  IF p_course_id IS NULL THEN
    INSERT INTO public.courses (
      name, trainer_id, trainer_name, trainer_phone, room, schedule_days,
      schedule_time, schedule_end_time, has_interview, interview_date,
      total_lectures, start_date, end_date, has_certificates,
      certificate_status, created_by, committee_id, branch_id
    ) VALUES (
      p_course->>'name',
      NULLIF(p_course->>'trainer_id', '')::UUID,
      COALESCE(p_course->>'trainer_name', ''),
      NULLIF(p_course->>'trainer_phone', ''),
      p_course->>'room',
      ARRAY(SELECT jsonb_array_elements_text(p_course->'schedule_days')),
      NULLIF(p_course->>'schedule_time', '')::TIME,
      NULLIF(p_course->>'schedule_end_time', '')::TIME,
      COALESCE((p_course->>'has_interview')::BOOLEAN, FALSE),
      NULLIF(p_course->>'interview_date', '')::DATE,
      v_total_lectures,
      NULLIF(p_course->>'start_date', '')::DATE,
      NULLIF(p_course->>'end_date', '')::DATE,
      COALESCE((p_course->>'has_certificates')::BOOLEAN, FALSE),
      COALESCE(NULLIF(p_course->>'certificate_status', ''), 'pending'),
      v_requester_id,
      v_course_committee,
      v_course_branch
    )
    RETURNING id INTO v_course_id;
  ELSE
    UPDATE public.courses
    SET
      name = p_course->>'name',
      trainer_id = NULLIF(p_course->>'trainer_id', '')::UUID,
      trainer_name = COALESCE(p_course->>'trainer_name', ''),
      trainer_phone = NULLIF(p_course->>'trainer_phone', ''),
      room = p_course->>'room',
      schedule_days = ARRAY(SELECT jsonb_array_elements_text(p_course->'schedule_days')),
      schedule_time = NULLIF(p_course->>'schedule_time', '')::TIME,
      schedule_end_time = NULLIF(p_course->>'schedule_end_time', '')::TIME,
      has_interview = COALESCE((p_course->>'has_interview')::BOOLEAN, FALSE),
      interview_date = NULLIF(p_course->>'interview_date', '')::DATE,
      total_lectures = v_total_lectures,
      start_date = NULLIF(p_course->>'start_date', '')::DATE,
      end_date = NULLIF(p_course->>'end_date', '')::DATE,
      has_certificates = COALESCE((p_course->>'has_certificates')::BOOLEAN, FALSE),
      committee_id = v_course_committee,
      updated_at = NOW()
    WHERE id = p_course_id;

    v_course_id := p_course_id;
  END IF;

  DELETE FROM public.course_organizers WHERE course_id = v_course_id;
  INSERT INTO public.course_organizers (course_id, volunteer_id, name, phone)
  SELECT v_course_id, organizer.volunteer_id, organizer.name, organizer.phone
  FROM jsonb_to_recordset(p_organizers) AS organizer(volunteer_id UUID, name TEXT, phone TEXT);

  DELETE FROM public.course_marketers WHERE course_id = v_course_id;
  INSERT INTO public.course_marketers (course_id, volunteer_id, name, phone)
  SELECT v_course_id, marketer.volunteer_id, marketer.name, marketer.phone
  FROM jsonb_to_recordset(p_marketers) AS marketer(volunteer_id UUID, name TEXT, phone TEXT);

  DELETE FROM public.course_trainers WHERE course_id = v_course_id;
  INSERT INTO public.course_trainers (course_id, trainer_id)
  SELECT v_course_id, trainer_id
  FROM unnest(p_trainer_ids) AS trainer_id;

  FOR v_index IN 1..array_length(p_lecture_dates, 1) LOOP
    SELECT id INTO v_existing_lecture_id
    FROM public.course_lectures
    WHERE course_id = v_course_id
    ORDER BY lecture_number, id
    OFFSET v_index - 1
    LIMIT 1;

    IF v_existing_lecture_id IS NULL THEN
      INSERT INTO public.course_lectures (course_id, lecture_number, date, status)
      VALUES (v_course_id, v_index, p_lecture_dates[v_index], 'scheduled')
      RETURNING id INTO v_existing_lecture_id;
    ELSE
      UPDATE public.course_lectures
      SET lecture_number = v_index, date = p_lecture_dates[v_index]
      WHERE id = v_existing_lecture_id;
    END IF;

    v_kept_lecture_ids := array_append(v_kept_lecture_ids, v_existing_lecture_id);
  END LOOP;

  DELETE FROM public.course_lectures
  WHERE course_id = v_course_id
    AND NOT (id = ANY(v_kept_lecture_ids));

  IF p_course_id IS NULL THEN
    INSERT INTO public.course_ads (course_id, ad_number, ad_date, created_by)
    SELECT v_course_id, ad.ordinality, ad.ad_date, v_requester_id
    FROM unnest(p_ad_dates) WITH ORDINALITY AS ad(ad_date, ordinality);
  END IF;

  RETURN v_course_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_course_with_relations(UUID, JSONB, JSONB, JSONB, UUID[], DATE[], DATE[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_course_with_relations(UUID, JSONB, JSONB, JSONB, UUID[], DATE[], DATE[]) TO authenticated;
