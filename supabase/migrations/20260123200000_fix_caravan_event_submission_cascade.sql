-- Fix cascading delete by adding source tracking to activity_submissions
-- This adds columns to track where the submission came from (caravan, event, etc.)

-- Step 1: Add source tracking columns
ALTER TABLE public.activity_submissions 
ADD COLUMN IF NOT EXISTS source_type TEXT,
ADD COLUMN IF NOT EXISTS source_id UUID;

-- Step 2: Update the caravan trigger to save source info
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
    IF NEW.is_volunteer = TRUE AND NEW.volunteer_id IS NOT NULL THEN
        
        SELECT id INTO v_activity_type_id
        FROM public.activity_types
        WHERE LOWER(name) = 'caravan'
        LIMIT 1;
        
        SELECT id INTO v_committee_id
        FROM public.committees
        WHERE name ILIKE 'Caravans'
        LIMIT 1;

        IF v_activity_type_id IS NULL THEN
            INSERT INTO public.activity_types (name, name_ar, description, description_ar, points, mode, committee_id)
            VALUES ('Caravan', 'قافلة', 'Participation in a caravan', 'المشاركة في قافلة', 5, 'group', v_committee_id)
            RETURNING id INTO v_activity_type_id;
        END IF;

        IF v_committee_id IS NULL THEN
            SELECT committee_id INTO v_committee_id
            FROM public.profiles WHERE id = NEW.volunteer_id;
        END IF;

        SELECT name INTO v_caravan_name
        FROM public.caravans WHERE id = NEW.caravan_id;

        -- Insert with source tracking
        INSERT INTO public.activity_submissions (
            volunteer_id, activity_type_id, committee_id, description,
            status, points_awarded, submitted_at,
            source_type, source_id
        ) VALUES (
            NEW.volunteer_id, v_activity_type_id, v_committee_id,
            'قافلة: ' || COALESCE(v_caravan_name, 'Unknown'),
            'approved', 5, NOW(),
            'caravan', NEW.caravan_id
        );
    END IF;
    RETURN NEW;
END;
$$;

-- Step 3: Update the event trigger to save source info  
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
    IF NEW.is_volunteer = TRUE AND NEW.volunteer_id IS NOT NULL THEN
        
        SELECT id INTO v_activity_type_id
        FROM public.activity_types
        WHERE LOWER(name) = 'event'
        LIMIT 1;
        
        SELECT id INTO v_committee_id
        FROM public.committees
        WHERE name ILIKE 'Events'
        LIMIT 1;

        IF v_activity_type_id IS NULL THEN
            INSERT INTO public.activity_types (name, name_ar, description, description_ar, points, mode, committee_id)
            VALUES ('Event', 'ايفنت', 'Participation in an event', 'المشاركة في ايفنت', 5, 'group', v_committee_id)
            RETURNING id INTO v_activity_type_id;
        END IF;

        IF v_committee_id IS NULL THEN
            SELECT committee_id INTO v_committee_id
            FROM public.profiles WHERE id = NEW.volunteer_id;
        END IF;

        SELECT name INTO v_event_name
        FROM public.events WHERE id = NEW.event_id;

        -- Insert with source tracking
        INSERT INTO public.activity_submissions (
            volunteer_id, activity_type_id, committee_id, description,
            status, points_awarded, submitted_at,
            source_type, source_id
        ) VALUES (
            NEW.volunteer_id, v_activity_type_id, v_committee_id,
            'ايفنت: ' || COALESCE(v_event_name, 'Unknown'),
            'approved', 5, NOW(),
            'event', NEW.event_id
        );
    END IF;
    RETURN NEW;
END;
$$;

-- Step 4: Simple delete triggers using source_id
CREATE OR REPLACE FUNCTION public.delete_caravan_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.is_volunteer = TRUE AND OLD.volunteer_id IS NOT NULL THEN
        DELETE FROM public.activity_submissions
        WHERE volunteer_id = OLD.volunteer_id
          AND source_type = 'caravan'
          AND source_id = OLD.caravan_id;
    END IF;
    RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_event_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.is_volunteer = TRUE AND OLD.volunteer_id IS NOT NULL THEN
        DELETE FROM public.activity_submissions
        WHERE volunteer_id = OLD.volunteer_id
          AND source_type = 'event'
          AND source_id = OLD.event_id;
    END IF;
    RETURN OLD;
END;
$$;

-- Step 5: Create/recreate triggers
DROP TRIGGER IF EXISTS on_caravan_participant_deleted ON public.caravan_participants;
CREATE TRIGGER on_caravan_participant_deleted
    BEFORE DELETE ON public.caravan_participants
    FOR EACH ROW EXECUTE FUNCTION public.delete_caravan_submission();

DROP TRIGGER IF EXISTS on_event_participant_deleted ON public.event_participants;
CREATE TRIGGER on_event_participant_deleted
    BEFORE DELETE ON public.event_participants
    FOR EACH ROW EXECUTE FUNCTION public.delete_event_submission();
