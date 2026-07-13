-- Add wore_vest column to ethics_calls_participants
ALTER TABLE public.ethics_calls_participants 
ADD COLUMN IF NOT EXISTS wore_vest BOOLEAN DEFAULT false;

-- Update award_ethics_call_points to handle wore_vest
CREATE OR REPLACE FUNCTION public.award_ethics_call_points(participants json)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    p_record json;
    v_activity_type_id uuid;
    v_committee_id uuid;
    v_volunteer_id uuid;
    v_status text;
    v_points integer;
    v_submitted_at timestamptz;
    v_description text;
    v_wore_vest boolean;
BEGIN
    FOR p_record IN SELECT * FROM json_array_elements(participants)
    LOOP
        v_volunteer_id := (p_record->>'volunteer_id')::uuid;
        v_activity_type_id := (p_record->>'activity_type_id')::uuid;
        v_committee_id := (p_record->>'committee_id')::uuid;
        v_status := (p_record->>'status')::text;
        v_points := (p_record->>'points_awarded')::integer;
        v_submitted_at := (p_record->>'submitted_at')::timestamptz;
        v_description := (p_record->>'description')::text;
        -- Handle wore_vest (defaults to false if null)
        v_wore_vest := COALESCE((p_record->>'wore_vest')::boolean, false);

        -- Insert into activity_submissions
        -- We assume activity_submissions has a wore_vest column based on existing codebase usage
        INSERT INTO public.activity_submissions (
            volunteer_id,
            activity_type_id,
            committee_id,
            status,
            points_awarded,
            submitted_at,
            description,
            wore_vest
        ) VALUES (
            v_volunteer_id,
            v_activity_type_id,
            v_committee_id,
            v_status,
            v_points,
            v_submitted_at,
            v_description,
            v_wore_vest
        );
        
        -- Update user profile total points
        UPDATE public.profiles
        SET total_points = COALESCE(total_points, 0) + v_points
        WHERE id = v_volunteer_id;
        
    END LOOP;
END;
$$;
