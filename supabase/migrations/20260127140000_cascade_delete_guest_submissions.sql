-- =========================================================
-- FIX: Cascade Delete for Guest Submissions
-- =========================================================
-- Problem: When a guest is removed from a caravan/event, their submission remains.
-- Solution: Update the delete triggers to handle both volunteers AND guests.

-- Step 1: Update caravan participant delete function to handle guests
CREATE OR REPLACE FUNCTION public.delete_caravan_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caravan_name TEXT;
BEGIN
    -- Get caravan name for matching guest submissions by description
    SELECT name INTO v_caravan_name
    FROM public.caravans
    WHERE id = OLD.caravan_id;

    IF OLD.is_volunteer = TRUE AND OLD.volunteer_id IS NOT NULL THEN
        -- Delete volunteer submission by source tracking
        DELETE FROM public.activity_submissions
        WHERE volunteer_id = OLD.volunteer_id
          AND source_type = 'caravan'
          AND source_id = OLD.caravan_id;
    ELSE
        -- Delete guest submission by matching guest_name and description
        DELETE FROM public.activity_submissions
        WHERE participant_type = 'guest'
          AND guest_name = OLD.name
          AND (
              description = 'ضيف في قافلة: ' || v_caravan_name
              OR (source_type = 'caravan' AND source_id = OLD.caravan_id AND guest_name = OLD.name)
          );
    END IF;
    RETURN OLD;
END;
$$;

-- Step 2: Update event participant delete function to handle guests
CREATE OR REPLACE FUNCTION public.delete_event_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event_name TEXT;
BEGIN
    -- Get event name for matching guest submissions by description
    SELECT name INTO v_event_name
    FROM public.events
    WHERE id = OLD.event_id;

    IF OLD.is_volunteer = TRUE AND OLD.volunteer_id IS NOT NULL THEN
        -- Delete volunteer submission by source tracking
        DELETE FROM public.activity_submissions
        WHERE volunteer_id = OLD.volunteer_id
          AND source_type = 'event'
          AND source_id = OLD.event_id;
    ELSE
        -- Delete guest submission by matching guest_name and description
        DELETE FROM public.activity_submissions
        WHERE participant_type = 'guest'
          AND guest_name = OLD.name
          AND (
              description = 'ضيف في نزولة: ' || v_event_name
              OR (source_type = 'event' AND source_id = OLD.event_id AND guest_name = OLD.name)
          );
    END IF;
    RETURN OLD;
END;
$$;

-- Step 3: Recreate triggers (they already exist, but this ensures they use updated functions)
DROP TRIGGER IF EXISTS on_caravan_participant_deleted ON public.caravan_participants;
CREATE TRIGGER on_caravan_participant_deleted
    BEFORE DELETE ON public.caravan_participants
    FOR EACH ROW EXECUTE FUNCTION public.delete_caravan_submission();

DROP TRIGGER IF EXISTS on_event_participant_deleted ON public.event_participants;
CREATE TRIGGER on_event_participant_deleted
    BEFORE DELETE ON public.event_participants
    FOR EACH ROW EXECUTE FUNCTION public.delete_event_submission();
