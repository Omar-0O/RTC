-- Migration to strictly tie Caravans activities to the Caravans Committee

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
BEGIN
    -- Only process if this is a volunteer (not a guest)
    IF NEW.is_volunteer = TRUE AND NEW.volunteer_id IS NOT NULL THEN

        -- 1. Get or create the 'Caravan' activity type
        SELECT id INTO v_activity_type_id
        FROM public.activity_types
        WHERE LOWER(name) = 'caravan'
        LIMIT 1;

        -- 2. Dynamically find the Caravans committee
        SELECT id INTO v_committee_id
        FROM public.committees
        WHERE name ILIKE 'Caravans' OR name = 'لجنة قوافل'
        LIMIT 1;

        IF v_activity_type_id IS NULL THEN
            -- Create the activity type if it doesn't exist
            INSERT INTO public.activity_types (name, name_ar, description, description_ar, points, mode, committee_id)
            VALUES ('Caravan', 'قافلة', 'Participation in a caravan', 'المشاركة في قافلة', 5, 'group', v_committee_id)
            RETURNING id INTO v_activity_type_id;
        END IF;

        -- We do NOT fallback to the volunteer's personal committee. 
        -- The points should strictly go to the specific Caravan committee.
        -- If for some very strange reason the committee doesn't exist, we leave it NULL 
        -- or whatever it gets (though it should always exist).

        -- 3. Get caravan name for description
        SELECT name INTO v_caravan_name
        FROM public.caravans
        WHERE id = NEW.caravan_id;

        -- Insert with source tracking
        INSERT INTO public.activity_submissions (
            volunteer_id,
            activity_type_id,
            committee_id,
            description,
            status,
            points_awarded,
            submitted_at,
            source_type,
            source_id
        ) VALUES (
            NEW.volunteer_id,
            v_activity_type_id,
            v_committee_id,
            'قافلة: ' || COALESCE(v_caravan_name, 'Unknown'),
            'approved',
            5,
            NOW(),
            'caravan',
            NEW.caravan_id
        );
    END IF;
    RETURN NEW;
END;
$$;

-- Fix existing caravan submissions to point to the correct Caravans committee
DO $$
DECLARE
    v_caravans_committee_id UUID;
BEGIN
    SELECT id INTO v_caravans_committee_id
    FROM public.committees
    WHERE name ILIKE 'Caravans' OR name = 'لجنة قوافل'
    LIMIT 1;

    IF v_caravans_committee_id IS NOT NULL THEN
        UPDATE public.activity_submissions
        SET committee_id = v_caravans_committee_id
        WHERE source_type = 'caravan' AND committee_id IS DISTINCT FROM v_caravans_committee_id;
    END IF;
END;
$$;
