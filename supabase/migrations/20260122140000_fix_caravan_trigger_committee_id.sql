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

        IF v_activity_type_id IS NULL THEN
            -- Create the activity type if it doesn't exist
            INSERT INTO public.activity_types (name, name_ar, description, description_ar, points, mode)
            VALUES ('Caravan', 'قافلة', 'Participation in a caravan', 'المشاركة في قافلة', 5, 'group')
            RETURNING id INTO v_activity_type_id;
        END IF;

        -- 2. DYNAMICALLY Get the Caravans committee ID
        SELECT id INTO v_committee_id
        FROM public.committees
        WHERE name = 'Caravans'
        LIMIT 1;

        -- Fallback to volunteer's committee if 'Caravans' committee not found
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
