-- Trigger function to automatically log event participation
CREATE OR REPLACE FUNCTION public.log_event_participation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_activity_type_id UUID;
    v_committee_id UUID;
    v_event_name TEXT;
BEGIN
    -- Only process if this is a volunteer (not a guest)
    IF NEW.is_volunteer = TRUE AND NEW.volunteer_id IS NOT NULL THEN

        -- 1. Get or create the 'Event' activity type
        SELECT id INTO v_activity_type_id
        FROM public.activity_types
        WHERE LOWER(name) = 'event'
        LIMIT 1;

        IF v_activity_type_id IS NULL THEN
            -- Create the activity type if it doesn't exist
            INSERT INTO public.activity_types (name, name_ar, description, description_ar, points, mode)
            VALUES ('Event', 'ايفنت', 'Participation in an event', 'المشاركة في ايفنت', 5, 'group')
            RETURNING id INTO v_activity_type_id;
        END IF;

        -- 2. Use the Events committee ID (hardcoded for reliability)
        v_committee_id := 'c82bc5e2-49b1-4951-9f1e-249afeaafeb8'::UUID;

        -- Fallback to volunteer's committee if needed
        IF v_committee_id IS NULL THEN
            SELECT committee_id INTO v_committee_id
            FROM public.profiles
            WHERE id = NEW.volunteer_id;
        END IF;

        -- 3. Get event name for description
        SELECT name INTO v_event_name
        FROM public.events
        WHERE id = NEW.event_id;

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
            'ايفنت: ' || COALESCE(v_event_name, 'Unknown'),
            'approved',
            5,
            NOW()
        );

    END IF;

    RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS on_event_participant_added ON public.event_participants;
CREATE TRIGGER on_event_participant_added
    AFTER INSERT ON public.event_participants
    FOR EACH ROW
    EXECUTE FUNCTION public.log_event_participation();
