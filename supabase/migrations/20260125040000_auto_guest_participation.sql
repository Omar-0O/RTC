-- Function to log guest participation in Caravans
CREATE OR REPLACE FUNCTION public.log_guest_caravan_participation()
RETURNS TRIGGER AS $$
DECLARE
  v_activity_type_id UUID := 'b665c0e2-63fe-45a7-96a9-839e559196e1'; -- "Caravan"
  v_committee_id UUID;
  v_points INTEGER;
BEGIN
  -- Only for guests (is_volunteer = false)
  IF NEW.is_volunteer = false THEN
    
    -- Get committee_id from the caravan? 
    -- Caravans table has 'created_by' but maybe not direct committee link?
    -- Activity Type 'Caravan' usually has a default committee_id.
    -- Let's check activity_types for default committee.
    SELECT points, committee_id INTO v_points, v_committee_id
    FROM public.activity_types
    WHERE id = v_activity_type_id;

    -- Insert submission
    INSERT INTO public.activity_submissions (
      participant_type,
      guest_name,
      activity_type_id,
      committee_id, -- Might be null if activity type doesn't have one, but usually required.
      submitted_at,
      status,
      points_awarded,
      description
    ) VALUES (
      'guest',
      NEW.name,
      v_activity_type_id,
      v_committee_id, -- Fallback to activity's committee
      NOW(),
      'approved',
      COALESCE(v_points, 0),
      'Guest participation in Caravan'
    );
    
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for Caravans
DROP TRIGGER IF EXISTS on_guest_caravan_add ON public.caravan_participants;
CREATE TRIGGER on_guest_caravan_add
  AFTER INSERT ON public.caravan_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.log_guest_caravan_participation();


-- Function to log guest participation in Ethics Calls
CREATE OR REPLACE FUNCTION public.log_guest_ethics_participation()
RETURNS TRIGGER AS $$
DECLARE
  v_activity_type_id UUID := '01bbf6f0-becd-47fe-b77e-3fd98ee075cd'; -- "Ethics Publishing"
  v_committee_id UUID;
  v_points INTEGER;
BEGIN
  -- Only for guests (is_volunteer = false)
  IF NEW.is_volunteer = false THEN
    
    SELECT points, committee_id INTO v_points, v_committee_id
    FROM public.activity_types
    WHERE id = v_activity_type_id;

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
      'Guest participation in Ethics Call'
    );
    
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for Ethics Calls
DROP TRIGGER IF EXISTS on_guest_ethics_add ON public.ethics_calls_participants;
CREATE TRIGGER on_guest_ethics_add
  AFTER INSERT ON public.ethics_calls_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.log_guest_ethics_participation();
