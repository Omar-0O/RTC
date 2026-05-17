-- ============================================================
-- Update trigger: log participation for ALL trainers in course_trainers
-- Removes the requirement for trainer.user_id IS NOT NULL
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_trainer_lecture_participation()
RETURNS TRIGGER AS $$
DECLARE
    v_course          RECORD;
    v_activity_type_id UUID;
    v_points          INTEGER;
    v_trainer_rec     RECORD;
BEGIN
    -- Only proceed if status changed to 'completed'
    IF OLD.status != 'completed' AND NEW.status = 'completed' THEN

        -- Get course details
        SELECT id, name, committee_id, trainer_id
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
                SELECT t.id AS trainer_id
                FROM   public.course_trainers ct
                JOIN   public.trainers t ON t.id = ct.trainer_id
                WHERE  ct.course_id = NEW.course_id
                -- Removed: AND t.user_id IS NOT NULL
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
                        activity_type_id,
                        committee_id,
                        submitted_at,
                        status,
                        points_awarded,
                        description
                    ) VALUES (
                        'trainer',
                        v_trainer_rec.trainer_id,
                        v_activity_type_id,
                        v_course.committee_id,
                        NOW(),
                        'approved',
                        COALESCE(v_points, 0),
                        'Lecture ' || NEW.lecture_number || ' for Course: ' || v_course.name
                    );
                END IF;
            END LOOP;

        -- ---- Fallback: legacy single trainer_id on courses ----
        ELSIF v_course.trainer_id IS NOT NULL THEN

            -- Removed: checking if user_id is not null from trainers table
            IF NOT EXISTS (
                SELECT 1 FROM public.activity_submissions
                WHERE  trainer_id        = v_course.trainer_id
                  AND  activity_type_id  = v_activity_type_id
                  AND  description ILIKE '%Lecture ' || NEW.lecture_number || '%' || v_course.name || '%'
            ) THEN
                INSERT INTO public.activity_submissions (
                    participant_type,
                    trainer_id,
                    activity_type_id,
                    committee_id,
                    submitted_at,
                    status,
                    points_awarded,
                    description
                ) VALUES (
                    'trainer',
                    v_course.trainer_id,
                    v_activity_type_id,
                    v_course.committee_id,
                    NOW(),
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
