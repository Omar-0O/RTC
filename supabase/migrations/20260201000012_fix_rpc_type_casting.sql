-- Fix type mismatch for 'status' column (text vs submission_status enum)
-- Recreating the function with explicit casting

CREATE OR REPLACE FUNCTION public.award_ethics_call_points(participants jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    p_record jsonb;
    v_activity_type_id uuid;
    v_committee_id uuid;
    v_volunteer_id uuid;
    v_status text;
    v_points integer;
    v_submitted_at timestamptz;
    v_description text;
    v_wore_vest boolean;
BEGIN
    FOR p_record IN SELECT * FROM jsonb_array_elements(participants)
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
            v_status::public.submission_status, -- Explicit cast to enum
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
