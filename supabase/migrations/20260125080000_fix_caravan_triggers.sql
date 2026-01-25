-- =====================================
-- CONSOLIDATED FIX: Caravan Participant Triggers
-- =====================================
-- This migration cleans up all previous trigger definitions and creates
-- a single, correct set of triggers for volunteer and guest caravan participation.

-- Drop all old triggers to avoid conflicts
DROP TRIGGER IF EXISTS on_caravan_participant_added ON public.caravan_participants;
DROP TRIGGER IF EXISTS on_guest_caravan_add ON public.caravan_participants;
DROP TRIGGER IF EXISTS on_guest_caravan_participant_added ON public.caravan_participants;

-- Add guest_phone column if it doesn't exist
ALTER TABLE public.activity_submissions 
ADD COLUMN IF NOT EXISTS guest_phone TEXT;

-- =====================================
-- FUNCTION 1: Volunteer Caravan Participation
-- =====================================
CREATE OR REPLACE FUNCTION public.log_volunteer_caravan_participation()
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
BEGIN
    -- Only process VOLUNTEERS (is_volunteer = TRUE and volunteer_id is set)
    IF NEW.is_volunteer = TRUE AND NEW.volunteer_id IS NOT NULL THEN

        -- Get 'Caravan' activity type
        SELECT id, points, committee_id INTO v_activity_type_id, v_points, v_committee_id
        FROM public.activity_types
        WHERE LOWER(name) = 'caravan'
        LIMIT 1;

        IF v_activity_type_id IS NULL THEN
            -- Create the activity type if it doesn't exist
            INSERT INTO public.activity_types (name, name_ar, description, description_ar, points, mode)
            VALUES ('Caravan', 'قافلة', 'Participation in a caravan', 'المشاركة في قافلة', 5, 'group')
            RETURNING id, points INTO v_activity_type_id, v_points;
        END IF;

        -- Fallback committee to volunteer's committee
        IF v_committee_id IS NULL THEN
            SELECT committee_id INTO v_committee_id
            FROM public.profiles
            WHERE id = NEW.volunteer_id;
        END IF;

        -- Get caravan name
        SELECT name INTO v_caravan_name
        FROM public.caravans
        WHERE id = NEW.caravan_id;

        -- Insert activity submission
        INSERT INTO public.activity_submissions (
            participant_type,
            volunteer_id,
            activity_type_id,
            committee_id,
            description,
            status,
            points_awarded,
            wore_vest,
            submitted_at
        )
        VALUES (
            'volunteer',
            NEW.volunteer_id,
            v_activity_type_id,
            v_committee_id,
            'قافلة: ' || COALESCE(v_caravan_name, 'Unknown'),
            'approved',
            COALESCE(v_points, 5),
            NEW.wore_vest,
            NOW()
        );

    END IF;

    RETURN NEW;
END;
$$;

-- =====================================
-- FUNCTION 2: Guest Caravan Participation
-- =====================================
CREATE OR REPLACE FUNCTION public.log_guest_caravan_participation()
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
BEGIN
    -- Only process GUESTS (is_volunteer = FALSE)
    IF NEW.is_volunteer = FALSE THEN

        -- Get caravan name for description
        SELECT name INTO v_caravan_name
        FROM public.caravans
        WHERE id = NEW.caravan_id;

        -- Dynamic lookup for 'Caravan' activity type
        SELECT id, points, committee_id 
        INTO v_activity_type_id, v_points, v_committee_id
        FROM public.activity_types
        WHERE LOWER(name) = 'caravan'
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
                'ضيف في قافلة: ' || COALESCE(v_caravan_name, 'Unknown')
            );
        END IF;

    END IF;
    RETURN NEW;
END;
$$;

-- =====================================
-- CREATE TRIGGERS
-- =====================================
-- Volunteer Trigger
CREATE TRIGGER on_volunteer_caravan_participant_added
    AFTER INSERT ON public.caravan_participants
    FOR EACH ROW
    WHEN (NEW.is_volunteer = TRUE)
    EXECUTE FUNCTION public.log_volunteer_caravan_participation();

-- Guest Trigger
CREATE TRIGGER on_guest_caravan_participant_added
    AFTER INSERT ON public.caravan_participants
    FOR EACH ROW
    WHEN (NEW.is_volunteer = FALSE)
    EXECUTE FUNCTION public.log_guest_caravan_participation();
