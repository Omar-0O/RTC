-- Function to log trainer participation when a lecture is completed
CREATE OR REPLACE FUNCTION public.log_trainer_lecture_participation()
RETURNS TRIGGER AS $$
DECLARE
  v_trainer_id UUID;
  v_committee_id UUID;
  v_course_name TEXT;
  v_activity_type_id UUID := 'c4fc8641-7f5f-4905-9935-50e312c57810'; -- "Giving a Course Lecture"
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
      
      -- Get points for the activity type
      SELECT points INTO v_points
      FROM public.activity_types
      WHERE id = v_activity_type_id;

      -- Check for existing submission to avoid duplicates
      -- (Same trainer, same activity, same date/lecture)
      IF NOT EXISTS (
        SELECT 1 FROM public.activity_submissions
        WHERE trainer_id = v_trainer_id
          AND activity_type_id = v_activity_type_id
          AND description = 'Lecture ' || NEW.lecture_number || ' for Course ' || v_course_name
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
          'approved', -- Auto-approved
          COALESCE(v_points, 0),
          'Lecture ' || NEW.lecture_number || ' for Course ' || v_course_name
        );
        
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create Trigger
DROP TRIGGER IF EXISTS on_lecture_completion ON public.course_lectures;
CREATE TRIGGER on_lecture_completion
  AFTER UPDATE ON public.course_lectures
  FOR EACH ROW
  EXECUTE FUNCTION public.log_trainer_lecture_participation();
