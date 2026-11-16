-- Migration: Allow any authenticated user to manage course beneficiaries, lectures,
-- attendance, ads, and trainer_lecture_records across any course, and also record
-- trainer_lecture_records inside the SECURITY DEFINER lecture completion trigger.

BEGIN;

-- 1. Ensure trainer_lecture_records table exists with RLS enabled
CREATE TABLE IF NOT EXISTS public.trainer_lecture_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  lecture_id UUID REFERENCES public.course_lectures(id) ON DELETE CASCADE,
  trainer_name TEXT NOT NULL,
  trainer_phone TEXT,
  volunteer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.trainer_lecture_records ENABLE ROW LEVEL SECURITY;

-- 2. Drop all existing policies on course sub-tables so stale role/branch restrictions do not block regular users
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'course_beneficiaries',
        'course_lectures',
        'course_attendance',
        'trainer_lecture_records',
        'course_ads'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END;
$$;

-- 3. Grant authenticated users full operational access on course sub-tables
CREATE POLICY "authenticated_all_course_beneficiaries"
  ON public.course_beneficiaries
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_all_course_lectures"
  ON public.course_lectures
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_all_course_attendance"
  ON public.course_attendance
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_all_trainer_lecture_records"
  ON public.trainer_lecture_records
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_all_course_ads"
  ON public.course_ads
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Update log_trainer_lecture_participation() trigger function so lecture completion
--    also inserts trainer_lecture_records server-side (SECURITY DEFINER) without duplicates.
CREATE OR REPLACE FUNCTION public.log_trainer_lecture_participation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course            RECORD;
  v_activity_type_id  UUID;
  v_points            INTEGER;
  v_trainer_rec       RECORD;
  v_user_id           UUID;
  v_has_records       BOOLEAN := false;
BEGIN
  -- Only proceed if status changed to 'completed'
  IF COALESCE(OLD.status, '') <> 'completed' AND NEW.status = 'completed' THEN

    SELECT id, name, committee_id, trainer_id, trainer_name, trainer_phone, branch_id
    INTO v_course
    FROM public.courses
    WHERE id = NEW.course_id;

    IF NOT FOUND THEN
      RETURN NEW;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.trainer_lecture_records
      WHERE lecture_id = NEW.id
    ) INTO v_has_records;

    -- Lookup activity type once for activity_submissions
    SELECT id, points INTO v_activity_type_id, v_points
    FROM public.activity_types
    WHERE name ILIKE '%Course Lecture%' OR name ILIKE '%Trainer Lecture%'
    LIMIT 1;

    IF v_activity_type_id IS NULL THEN
      SELECT id, points INTO v_activity_type_id, v_points
      FROM public.activity_types
      WHERE name_ar ILIKE '%محاضرة%' OR name ILIKE '%Lecture%'
      LIMIT 1;
    END IF;

    -- ---- Case 1: Multi-trainer system (course_trainers) ----
    IF EXISTS (SELECT 1 FROM public.course_trainers WHERE course_id = NEW.course_id) THEN

      FOR v_trainer_rec IN
        SELECT
          t.id AS trainer_id,
          t.user_id,
          t.phone,
          COALESCE(NULLIF(t.name_ar, ''), NULLIF(t.name_en, ''), 'مدرب') AS trainer_display_name
        FROM public.course_trainers ct
        JOIN public.trainers t ON t.id = ct.trainer_id
        WHERE ct.course_id = NEW.course_id
      LOOP
        IF NOT v_has_records THEN
          INSERT INTO public.trainer_lecture_records (
            course_id,
            lecture_id,
            trainer_name,
            trainer_phone,
            volunteer_id
          ) VALUES (
            NEW.course_id,
            NEW.id,
            v_trainer_rec.trainer_display_name,
            v_trainer_rec.phone,
            v_trainer_rec.user_id
          );
        END IF;

        IF v_activity_type_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM public.activity_submissions
          WHERE trainer_id = v_trainer_rec.trainer_id
            AND activity_type_id = v_activity_type_id
            AND description ILIKE '%Lecture ' || NEW.lecture_number || '%' || v_course.name || '%'
        ) THEN
          INSERT INTO public.activity_submissions (
            participant_type,
            trainer_id,
            volunteer_id,
            activity_type_id,
            committee_id,
            branch_id,
            submitted_at,
            status,
            points_awarded,
            description
          ) VALUES (
            'trainer',
            v_trainer_rec.trainer_id,
            v_trainer_rec.user_id,
            v_activity_type_id,
            v_course.committee_id,
            v_course.branch_id,
            (NEW.date::text || ' 12:00:00')::timestamptz,
            'approved',
            COALESCE(v_points, 0),
            'Lecture ' || NEW.lecture_number || ' for Course: ' || v_course.name
          );
        END IF;
      END LOOP;

    -- ---- Case 2: Legacy single trainer_id on courses ----
    ELSIF v_course.trainer_id IS NOT NULL THEN

      SELECT user_id INTO v_user_id
      FROM public.trainers
      WHERE id = v_course.trainer_id;

      IF NOT v_has_records THEN
        INSERT INTO public.trainer_lecture_records (
          course_id,
          lecture_id,
          trainer_name,
          trainer_phone,
          volunteer_id
        )
        SELECT
          NEW.course_id,
          NEW.id,
          COALESCE(NULLIF(t.name_ar, ''), NULLIF(t.name_en, ''), NULLIF(v_course.trainer_name, ''), 'مدرب'),
          COALESCE(t.phone, v_course.trainer_phone),
          t.user_id
        FROM public.trainers t
        WHERE t.id = v_course.trainer_id;
      END IF;

      IF v_activity_type_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.activity_submissions
        WHERE trainer_id = v_course.trainer_id
          AND activity_type_id = v_activity_type_id
          AND description ILIKE '%Lecture ' || NEW.lecture_number || '%' || v_course.name || '%'
      ) THEN
        INSERT INTO public.activity_submissions (
          participant_type,
          trainer_id,
          volunteer_id,
          activity_type_id,
          committee_id,
          branch_id,
          submitted_at,
          status,
          points_awarded,
          description
        ) VALUES (
          'trainer',
          v_course.trainer_id,
          v_user_id,
          v_activity_type_id,
          v_course.committee_id,
          v_course.branch_id,
          (NEW.date::text || ' 12:00:00')::timestamptz,
          'approved',
          COALESCE(v_points, 0),
          'Lecture ' || NEW.lecture_number || ' for Course: ' || v_course.name
        );
      END IF;

    -- ---- Case 3: External trainer stored directly on courses (trainer_name/trainer_phone) ----
    ELSIF COALESCE(NULLIF(trim(v_course.trainer_name), ''), '') <> '' THEN

      IF NOT v_has_records THEN
        SELECT p.id INTO v_user_id
        FROM public.profiles p
        WHERE v_course.trainer_phone IS NOT NULL
          AND regexp_replace(COALESCE(p.phone, ''), '[\s-]', '', 'g') =
              regexp_replace(v_course.trainer_phone, '[\s-]', '', 'g')
        LIMIT 1;

        INSERT INTO public.trainer_lecture_records (
          course_id,
          lecture_id,
          trainer_name,
          trainer_phone,
          volunteer_id
        ) VALUES (
          NEW.course_id,
          NEW.id,
          v_course.trainer_name,
          v_course.trainer_phone,
          v_user_id
        );
      END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_lecture_completion ON public.course_lectures;
DROP TRIGGER IF EXISTS on_lecture_complete ON public.course_lectures;
CREATE TRIGGER on_lecture_complete
  AFTER UPDATE ON public.course_lectures
  FOR EACH ROW
  EXECUTE FUNCTION public.log_trainer_lecture_participation();

COMMIT;
