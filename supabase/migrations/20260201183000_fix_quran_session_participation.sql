-- Fix: Log Quran session participation for the TEACHER instead of the organizer
-- When an organizer creates a session, the participation should be recorded for the teacher (محفظ)

-- Drop existing trigger
DROP TRIGGER IF EXISTS on_session_created ON public.quran_circle_sessions;

-- Update Trigger Function to log for teacher instead of auth.uid()
CREATE OR REPLACE FUNCTION public.log_quran_session_activity()
RETURNS TRIGGER AS $$
DECLARE
    quran_committee_id UUID;
    activity_type_id UUID;
    activity_points INTEGER;
    circle_teacher_name TEXT;
    circle_teacher_volunteer_id UUID;
BEGIN
    -- Get Quran Committee ID
    SELECT id INTO quran_committee_id FROM public.committees 
    WHERE name ILIKE '%Quran%' OR name_ar ILIKE '%قرآن%' 
    LIMIT 1;

    -- Get Activity Type ID and points
    SELECT id, COALESCE(points, 5) INTO activity_type_id, activity_points 
    FROM public.activity_types 
    WHERE name = 'Quran Circle Session' 
    LIMIT 1;

    -- Get Teacher Name AND volunteer_id from the circle
    SELECT t.name, t.volunteer_id INTO circle_teacher_name, circle_teacher_volunteer_id
    FROM public.quran_circles c
    LEFT JOIN public.quran_teachers t ON c.teacher_id = t.id
    WHERE c.id = NEW.circle_id;

    -- Log participation for the TEACHER (not the organizer)
    -- Only if teacher has a volunteer_id linked and required data exists
    IF circle_teacher_volunteer_id IS NOT NULL 
       AND quran_committee_id IS NOT NULL 
       AND activity_type_id IS NOT NULL THEN
        
        -- Insert Submission for the teacher
        INSERT INTO public.activity_submissions (
            volunteer_id,
            committee_id,
            activity_type_id,
            description,
            points_awarded,
            status,
            location,
            date
        ) VALUES (
            circle_teacher_volunteer_id,  -- Teacher's volunteer ID, not auth.uid()
            quran_committee_id,
            activity_type_id,
            'جلسة حلقة: ' || COALESCE(circle_teacher_name, 'حلقة قرآن'),
            activity_points,
            'approved',
            'branch',
            NEW.session_date
        );
        
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate Trigger
CREATE TRIGGER on_session_created
    AFTER INSERT ON public.quran_circle_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.log_quran_session_activity();
    