-- Automate participation logging for Quran Sessions

-- 1. Ensure Activity Type exists
-- Added 'name_ar' column as it is required (NOT NULL)
INSERT INTO public.activity_types (name, name_ar, description, points)
SELECT 'Quran Circle Session', 'جلسة حلقة قرآن', 'Leading a Quran circle session', 5
WHERE NOT EXISTS (
    SELECT 1 FROM public.activity_types WHERE name = 'Quran Circle Session'
);

-- 2. Create Trigger Function
CREATE OR REPLACE FUNCTION public.log_quran_session_activity()
RETURNS TRIGGER AS $$
DECLARE
    quran_committee_id UUID;
    activity_type_id UUID;
    circle_teacher_name TEXT;
    organizer_id UUID;
BEGIN
    -- Get Quran Committee ID (assuming name is 'Quran' or similar)
    SELECT id INTO quran_committee_id FROM public.committees 
    WHERE name ILIKE '%Quran%' OR name_ar ILIKE '%قرآن%' 
    LIMIT 1;

    -- Get Activity Type ID
    SELECT id INTO activity_type_id FROM public.activity_types 
    WHERE name = 'Quran Circle Session' 
    LIMIT 1;

    -- Get Teacher Name for description
    SELECT t.name INTO circle_teacher_name
    FROM public.quran_circles c
    LEFT JOIN public.quran_teachers t ON c.teacher_id = t.id
    WHERE c.id = NEW.circle_id;

    -- Determine who gets the points
    -- We give points to the USER WHO INSERTED the record (auth.uid()) because they are the one "doing" the session
    -- Ensure user is authenticated to avoid errors if inserted by system/anon (though RLS prevents that usually)
    IF auth.uid() IS NOT NULL AND quran_committee_id IS NOT NULL AND activity_type_id IS NOT NULL THEN
        
        -- Insert Submission
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
            auth.uid(),
            quran_committee_id,
            activity_type_id,
            'Session for circle: ' || COALESCE(circle_teacher_name, 'My Circle'),
            5, -- Points from type
            'approved', -- Auto-approve
            'remote',
            NEW.session_date
        );
        
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create Trigger
DROP TRIGGER IF EXISTS on_session_created ON public.quran_circle_sessions;

CREATE TRIGGER on_session_created
    AFTER INSERT ON public.quran_circle_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.log_quran_session_activity();
