-- Fix: Log guest participation in Caravans with dynamic Activity ID Lookup
CREATE OR REPLACE FUNCTION public.log_guest_caravan_participation()
RETURNS TRIGGER AS $$
DECLARE
  v_activity_type_id UUID;
  v_committee_id UUID;
  v_points INTEGER;
BEGIN
  -- Only for guests (is_volunteer = false)
  IF NEW.is_volunteer = false THEN
    
    -- Dynamic lookup for 'Caravan' activity type
    SELECT id, points, committee_id 
    INTO v_activity_type_id, v_points, v_committee_id
    FROM public.activity_types
    WHERE name ILIKE 'Caravan'
    LIMIT 1;

    -- If found, insert submission
    IF v_activity_type_id IS NOT NULL THEN
      INSERT INTO public.activity_submissions (
        participant_type,
        guest_name,
        activity_type_id,
        committee_id,
        submitted_at,
        status,
        points_awarded,
        description
      ) VALUES (
        'guest',
        NEW.name,
        v_activity_type_id,
        v_committee_id,
        NOW(),
        'approved',
        COALESCE(v_points, 0),
        'Guest participation in Caravan: ' || NEW.name
      );
    END IF;
    
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
