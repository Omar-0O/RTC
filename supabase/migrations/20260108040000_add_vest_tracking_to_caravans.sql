-- Add wore_vest column to caravan_participants
ALTER TABLE public.caravan_participants
ADD COLUMN IF NOT EXISTS wore_vest BOOLEAN DEFAULT TRUE;

-- Update the trigger function to handle vest points
CREATE OR REPLACE FUNCTION public.log_caravan_participation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_activity_type_id UUID;
    v_committee_id UUID;
    v_caravan_name TEXT;
    v_points INTEGER;
    v_points_vest INTEGER;
    v_points_no_vest INTEGER;
    v_points_base INTEGER;
BEGIN
    -- Only process if this is a volunteer (not a guest)
    IF NEW.is_volunteer = TRUE AND NEW.volunteer_id IS NOT NULL THEN

        -- 1. Get or create the 'Caravan' activity type
        SELECT id, points_with_vest, points_without_vest, points
        INTO v_activity_type_id, v_points_vest, v_points_no_vest, v_points_base
        FROM public.activity_types
        WHERE LOWER(name) = 'caravan'
        LIMIT 1;

        IF v_activity_type_id IS NULL THEN
            -- Create the activity type if it doesn't exist
            INSERT INTO public.activity_types (name, name_ar, description, description_ar, points, points_with_vest, points_without_vest, mode)
            VALUES ('Caravan', 'قافلة', 'Participation in a caravan', 'المشاركة في قافلة', 5, 15, 5, 'group')
            RETURNING id INTO v_activity_type_id;
            
            -- Set defaults for the newly created activity
            v_points_vest := 15;
            v_points_no_vest := 5;
            v_points_base := 5;
        END IF;

        -- 2. Use the Caravans committee ID (hardcoded for reliability)
        v_committee_id := 'e3517d42-3140-4323-bf79-5a6728fc45ef'::UUID;

        -- Fallback to volunteer's committee if needed
        IF v_committee_id IS NULL THEN
            SELECT committee_id INTO v_committee_id
            FROM public.profiles
            WHERE id = NEW.volunteer_id;
        END IF;

        -- 3. Get caravan name for description
        SELECT name INTO v_caravan_name
        FROM public.caravans
        WHERE id = NEW.caravan_id;

        -- 4. Calculate Points based on Vest
        IF NEW.wore_vest = TRUE THEN
            v_points := COALESCE(v_points_vest, 15); -- Fallback to 15 if null
        ELSE
            v_points := COALESCE(v_points_no_vest, 5); -- Fallback to 5 if null
        END IF;

        -- Safety check: ensure we don't award 0 points unless intended, though 0 is valid. 
        -- If activity definition has 0, then 0 it is.

        -- 5. Insert activity submission (approved with calculated points)
        INSERT INTO public.activity_submissions (
            volunteer_id,
            activity_type_id,
            committee_id,
            description,
            status,
            points_awarded,
            submitted_at
        )
        VALUES (
            NEW.volunteer_id,
            v_activity_type_id,
            v_committee_id,
            'قافلة: ' || COALESCE(v_caravan_name, 'Unknown') || (CASE WHEN NEW.wore_vest THEN ' (With Vest)' ELSE ' (No Vest)' END),
            'approved',
            v_points,
            NOW()
        );

    END IF;

    RETURN NEW;
END;
$$;
