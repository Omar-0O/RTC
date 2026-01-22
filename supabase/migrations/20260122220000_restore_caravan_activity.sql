-- Restore Caravan Activity Type and Fix Trigger

-- 1. Get Caravans Committee ID
DO $$
DECLARE
    v_committee_id UUID;
    v_activity_type_id UUID;
BEGIN
    -- Find the 'Caravans' committee (case-insensitive)
    SELECT id INTO v_committee_id
    FROM public.committees
    WHERE name ILIKE 'Caravans'
    LIMIT 1;

    -- If not found, you might want to create it or raise a notice.
    -- For safety, we'll just log a notice if missing.
    IF v_committee_id IS NULL THEN
        RAISE NOTICE 'Caravans committee not found during migration.';
    END IF;

    -- 2. Ensure 'Caravan' Activity Type exists
    SELECT id INTO v_activity_type_id
    FROM public.activity_types
    WHERE name = 'Caravan';

    IF v_activity_type_id IS NULL THEN
        INSERT INTO public.activity_types (
            name,
            name_ar,
            description,
            description_ar,
            points,
            mode,
            committee_id
        ) VALUES (
            'Caravan',
            'قافلة',
            'Participation in a caravan',
            'المشاركة في قافلة',
            5,
            'group',
            v_committee_id
        );
        RAISE NOTICE 'Restored Caravan activity type.';
    ELSE
        -- Update the committee_id just in case it was wrong/missing
        UPDATE public.activity_types
        SET committee_id = v_committee_id
        WHERE id = v_activity_type_id AND committee_id IS NULL;
    END IF;
END $$;


-- 3. Update the Trigger Function to be more robust
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
        WHERE name ILIKE 'Caravans'
        LIMIT 1;

        IF v_activity_type_id IS NULL THEN
            -- Create the activity type if it doesn't exist
            INSERT INTO public.activity_types (name, name_ar, description, description_ar, points, mode, committee_id)
            VALUES ('Caravan', 'قافلة', 'Participation in a caravan', 'المشاركة في قافلة', 5, 'group', v_committee_id)
            RETURNING id INTO v_activity_type_id;
        END IF;

        -- Fallback to volunteer's committee if Caravans committee not found
        IF v_committee_id IS NULL THEN
            SELECT committee_id INTO v_committee_id
            FROM public.profiles
            WHERE id = NEW.volunteer_id;
        END IF;

        -- 3. Get caravan name for description
        SELECT name INTO v_caravan_name
        FROM public.caravans
        WHERE id = NEW.caravan_id;

        -- 4. Insert activity submission (approved with 5 points)
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
            'قافلة: ' || COALESCE(v_caravan_name, 'Unknown'),
            'approved',
            5,
            NOW()
        );

    END IF;

    RETURN NEW;
END;
$$;
