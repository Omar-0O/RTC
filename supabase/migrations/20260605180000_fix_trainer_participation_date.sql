-- ============================================================================
-- Migration: Fix trainer participation date and RLS-inject trigger
-- Purpose: Set actual lecture date as submitted_at, map volunteer_id, 
--          and ensure branch_id is correctly mapped on trigger inserts.
-- ============================================================================

-- 1. Update auto_set_branch_id to support system/trigger inserts with custom branch_id
CREATE OR REPLACE FUNCTION public.auto_set_branch_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user_branch uuid;
  _is_admin boolean;
BEGIN
  -- If system/trigger/cron (auth.uid() is NULL) provided a branch_id explicitly, allow it
  IF auth.uid() IS NULL AND NEW.branch_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

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

-- 2. Update log_trainer_lecture_participation trigger function
CREATE OR REPLACE FUNCTION public.log_trainer_lecture_participation()
RETURNS TRIGGER AS $$
DECLARE
    v_course          RECORD;
    v_activity_type_id UUID;
    v_points          INTEGER;
    v_trainer_rec     RECORD;
    v_user_id         UUID;
BEGIN
    -- Only proceed if status changed to 'completed'
    IF OLD.status != 'completed' AND NEW.status = 'completed' THEN

        -- Get course details
        SELECT id, name, committee_id, trainer_id, branch_id
        INTO   v_course
        FROM   public.courses
        WHERE  id = NEW.course_id;

        -- Lookup activity type once
        SELECT id, points INTO v_activity_type_id, v_points
        FROM   public.activity_types
        WHERE  name ILIKE '%Course Lecture%' OR name ILIKE '%Trainer Lecture%'
        LIMIT  1;

        IF v_activity_type_id IS NULL THEN
            SELECT id, points INTO v_activity_type_id, v_points
            FROM   public.activity_types
            WHERE  name_ar ILIKE '%محاضرة%' OR name ILIKE '%Lecture%'
            LIMIT  1;
        END IF;

        IF v_activity_type_id IS NULL THEN
            RETURN NEW; -- No matching activity type, skip
        END IF;

        -- ---- Try course_trainers first (new multi-trainer system) ----
        IF EXISTS (SELECT 1 FROM public.course_trainers WHERE course_id = NEW.course_id) THEN

            FOR v_trainer_rec IN
                SELECT t.id AS trainer_id, t.user_id
                FROM   public.course_trainers ct
                JOIN   public.trainers t ON t.id = ct.trainer_id
                WHERE  ct.course_id = NEW.course_id
            LOOP
                -- Deduplicate: skip if already recorded
                IF NOT EXISTS (
                    SELECT 1 FROM public.activity_submissions
                    WHERE  trainer_id        = v_trainer_rec.trainer_id
                      AND  activity_type_id  = v_activity_type_id
                      AND  description ILIKE '%Lecture ' || NEW.lecture_number || '%' || v_course.name || '%'
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

        -- ---- Fallback: legacy single trainer_id on courses ----
        ELSIF v_course.trainer_id IS NOT NULL THEN

            -- Look up user_id for the legacy trainer
            SELECT user_id INTO v_user_id
            FROM   public.trainers
            WHERE  id = v_course.trainer_id;

            IF NOT EXISTS (
                SELECT 1 FROM public.activity_submissions
                WHERE  trainer_id        = v_course.trainer_id
                  AND  activity_type_id  = v_activity_type_id
                  AND  description ILIKE '%Lecture ' || NEW.lecture_number || '%' || v_course.name || '%'
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
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
