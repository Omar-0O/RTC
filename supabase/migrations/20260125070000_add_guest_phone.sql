-- Add guest_phone column to activity_submissions
ALTER TABLE public.activity_submissions 
ADD COLUMN IF NOT EXISTS guest_phone TEXT;

-- Update the Guest Caravan Trigger to include phone number
CREATE OR REPLACE FUNCTION public.log_guest_caravan_participation()
RETURNS TRIGGER AS $$
DECLARE
  v_activity_type_id UUID;
  v_committee_id UUID;
  v_points INTEGER;
  v_caravan_name TEXT;
BEGIN
  -- Only for guests (is_volunteer = false)
  IF NEW.is_volunteer = false THEN
    
    -- Get caravan name for context
    SELECT name INTO v_caravan_name
    FROM public.caravans
    WHERE id = NEW.caravan_id;
    
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
        guest_phone,
        activity_type_id,
        committee_id,
        submitted_at,
        status,
        points_awarded,
        description
      ) VALUES (
        'guest',
        NEW.name,
        NEW.phone,
        v_activity_type_id,
        v_committee_id,
        NOW(),
        'approved',
        COALESCE(v_points, 0),
        'Guest participation in Caravan: ' || COALESCE(v_caravan_name, 'Unknown')
      );
    END IF;
    
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Make sure trigger exists
DROP TRIGGER IF EXISTS on_guest_caravan_participant_added ON public.caravan_participants;
CREATE TRIGGER on_guest_caravan_participant_added
  AFTER INSERT ON public.caravan_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.log_guest_caravan_participation();
