-- ============================================================
-- course_trainers: Many-to-many between courses and trainers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.course_trainers (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id   UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    trainer_id  UUID NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (course_id, trainer_id)
);

-- Enable RLS
ALTER TABLE public.course_trainers ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read (same pattern as course_organizers)
DROP POLICY IF EXISTS "View course trainers" ON public.course_trainers;
CREATE POLICY "View course trainers" ON public.course_trainers
    FOR SELECT USING (true);

-- Allow heads/admins to manage
DROP POLICY IF EXISTS "Manage course trainers" ON public.course_trainers;
CREATE POLICY "Manage course trainers" ON public.course_trainers
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles
            WHERE role IN (
                'admin', 'supervisor',
                'head_production', 'head_fourth_year',
                'head_events', 'head_caravans',
                'committee_leader'
            )
        )
    );

-- ============================================================
-- Backfill: migrate existing courses.trainer_id into course_trainers
-- ============================================================
INSERT INTO public.course_trainers (course_id, trainer_id)
SELECT id, trainer_id
FROM   public.courses
WHERE  trainer_id IS NOT NULL
ON CONFLICT (course_id, trainer_id) DO NOTHING;

-- ============================================================
-- Update trigger: log participation for ALL trainers in course_trainers
-- Falls back to courses.trainer_id if course_trainers is empty (legacy)
-- ============================================================
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
                SELECT t.id AS trainer_id, t.user_id
                FROM   public.course_trainers ct
                JOIN   public.trainers t ON t.id = ct.trainer_id
                WHERE  ct.course_id = NEW.course_id
                  AND  t.user_id IS NOT NULL
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

            SELECT user_id INTO v_user_id
            FROM   public.trainers
            WHERE  id = v_course.trainer_id;

            IF v_user_id IS NOT NULL THEN
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

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger (it already exists, DROP + CREATE to replace)
DROP TRIGGER IF EXISTS on_lecture_complete ON public.course_lectures;
CREATE TRIGGER on_lecture_complete
    AFTER UPDATE ON public.course_lectures
    FOR EACH ROW
    EXECUTE FUNCTION public.log_trainer_lecture_participation();
