-- Fix: Log trainer participation when a lecture is completed (Dynamic Activity ID Lookup)
CREATE OR REPLACE FUNCTION public.log_trainer_lecture_participation()
RETURNS TRIGGER AS $$
DECLARE
  v_trainer_id UUID;
  v_committee_id UUID;
  v_course_name TEXT;
  v_activity_type_id UUID;
  v_points INTEGER;
BEGIN
  -- Only proceed if status changed to 'completed'
  IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
    
    -- Get course details (trainer and committee)
    SELECT trainer_id, committee_id, name INTO v_trainer_id, v_committee_id, v_course_name
    FROM public.courses
    WHERE id = NEW.course_id;

    -- If course has a trainer, log the participation
    IF v_trainer_id IS NOT NULL THEN
      
      -- Dynamic lookup for 'Giving a Course Lecture' activity type
      SELECT id, points INTO v_activity_type_id, v_points
      FROM public.activity_types
      WHERE name ILIKE '%Course Lecture%' OR name ILIKE '%Trainer Lecture%'
      LIMIT 1;

      IF v_activity_type_id IS NULL THEN
        -- Fallback: Try to find any trainer-related activity
        SELECT id, points INTO v_activity_type_id, v_points
        FROM public.activity_types
        WHERE name_ar ILIKE '%محاضرة%' OR name ILIKE '%Lecture%'
        LIMIT 1;
      END IF;

      -- If we found an activity type, proceed
      IF v_activity_type_id IS NOT NULL THEN
        -- Check for existing submission to avoid duplicates
        IF NOT EXISTS (
          SELECT 1 FROM public.activity_submissions
          WHERE trainer_id = v_trainer_id
            AND activity_type_id = v_activity_type_id
            AND description ILIKE '%Lecture ' || NEW.lecture_number || '%' || v_course_name || '%'
        ) THEN
          
          -- Insert submission
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
            v_trainer_id,
            v_activity_type_id,
            v_committee_id,
            NOW(),
            'approved',
            COALESCE(v_points, 0),
            'Lecture ' || NEW.lecture_number || ' for Course: ' || v_course_name
          );
          
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
