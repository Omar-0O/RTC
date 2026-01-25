-- Add user_id to trainers
ALTER TABLE public.trainers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id);

-- Ensure activity type exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM activity_types WHERE name = 'Giving a Course Lecture') THEN
        INSERT INTO activity_types (name, name_ar, points, description, description_ar, mode)
        VALUES ('Giving a Course Lecture', 'إعطاء محاضرة كورس', 50, 'Giving a lecture in a course', 'إعطاء محاضرة في دورة تدريبية', 'individual');
    END IF;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION log_trainer_lecture_participation()
RETURNS TRIGGER AS $$
DECLARE
    v_course RECORD;
    v_trainer RECORD;
    v_activity_type_id UUID;
    v_points INTEGER;
BEGIN
    -- Only proceed if status changed to 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        
        -- Get course info
        SELECT * INTO v_course FROM courses WHERE id = NEW.course_id;
        
        -- Get trainer info
        SELECT * INTO v_trainer FROM trainers WHERE id = v_course.trainer_id;
        
        -- If trainer is linked to a user
        IF v_trainer.user_id IS NOT NULL THEN
            
            -- Get activity type id
            SELECT id, points INTO v_activity_type_id, v_points FROM activity_types WHERE name = 'Giving a Course Lecture' LIMIT 1;
            
            -- Insert submission
            INSERT INTO activity_submissions (
                volunteer_id,
                activity_type_id,
                committee_id,
                status,
                points_awarded,
                submitted_at,
                description,
                proof_url 
            ) VALUES (
                v_trainer.user_id,
                v_activity_type_id,
                v_course.committee_id,
                'approved',
                v_points,
                NOW(),
                'Lecture ' || NEW.lecture_number || ' in ' || v_course.name,
                NULL
            );
            
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_lecture_complete ON course_lectures;
CREATE TRIGGER on_lecture_complete
    AFTER UPDATE ON course_lectures
    FOR EACH ROW
    EXECUTE FUNCTION log_trainer_lecture_participation();
