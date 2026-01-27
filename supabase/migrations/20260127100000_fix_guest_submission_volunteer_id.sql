-- =====================================
-- FIX: Allow NULL volunteer_id for Guest Submissions
-- =====================================
-- The activity_submissions table requires volunteer_id, but guests don't have one.
-- This migration:
-- 1. Alters the column to allow NULL
-- 2. Recreates the guest trigger to explicitly pass NULL

-- Step 1: Allow volunteer_id to be NULL
ALTER TABLE public.activity_submissions 
ALTER COLUMN volunteer_id DROP NOT NULL;

-- Step 2: Recreate the guest caravan participation function with explicit NULL volunteer_id
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
                volunteer_id,  -- Explicitly set to NULL for guests
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
                NULL,  -- Guest has no volunteer_id
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

-- Also fix the guest event participation function if it exists
CREATE OR REPLACE FUNCTION public.log_guest_event_participation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_activity_type_id UUID;
    v_committee_id UUID;
    v_event_name TEXT;
    v_points INTEGER;
BEGIN
    -- Only process GUESTS (is_volunteer = FALSE)
    IF NEW.is_volunteer = FALSE THEN

        -- Get event name for description
        SELECT name INTO v_event_name
        FROM public.events
        WHERE id = NEW.event_id;

        -- Dynamic lookup for 'Event' activity type
        SELECT id, points, committee_id 
        INTO v_activity_type_id, v_points, v_committee_id
        FROM public.activity_types
        WHERE LOWER(name) = 'event'
        LIMIT 1;

        -- If found, insert submission
        IF v_activity_type_id IS NOT NULL THEN
            INSERT INTO public.activity_submissions (
                participant_type,
                volunteer_id,  -- Explicitly set to NULL for guests
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
                NULL,  -- Guest has no volunteer_id
                NEW.name,
                NEW.phone,
                v_activity_type_id,
                v_committee_id,
                NOW(),
                'approved',
                COALESCE(v_points, 0),
                'ضيف في نزولة: ' || COALESCE(v_event_name, 'Unknown')
            );
        END IF;

    END IF;
    RETURN NEW;
END;
$$;
