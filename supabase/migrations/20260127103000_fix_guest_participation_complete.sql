-- =====================================
-- COMPREHENSIVE FIX: Guest Participation & Cleanup
-- =====================================

-- 1. Ensure volunteer_id is NULLABLE in activity_submissions
ALTER TABLE public.activity_submissions 
ALTER COLUMN volunteer_id DROP NOT NULL;

-- 2. Drop ALL potential conflicting triggers and functions
DROP TRIGGER IF EXISTS on_caravan_participant_added ON public.caravan_participants;
DROP TRIGGER IF EXISTS on_volunteer_caravan_participant_added ON public.caravan_participants;
DROP TRIGGER IF EXISTS on_guest_caravan_participant_added ON public.caravan_participants;
DROP TRIGGER IF EXISTS on_guest_caravan_add ON public.caravan_participants;

DROP FUNCTION IF EXISTS public.log_caravan_participation();
DROP FUNCTION IF EXISTS public.log_volunteer_caravan_participation();
DROP FUNCTION IF EXISTS public.log_guest_caravan_participation();

-- 3. Re-create the CORRECT Functions

-- Function 1: Volunteer (unchanged logic)
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
    IF NEW.is_volunteer = TRUE AND NEW.volunteer_id IS NOT NULL THEN
        -- Get 'Caravan' activity type
        SELECT id, points, committee_id INTO v_activity_type_id, v_points, v_committee_id
        FROM public.activity_types
        WHERE LOWER(name) = 'caravan' LIMIT 1;

        -- Create if not exists
        IF v_activity_type_id IS NULL THEN
            INSERT INTO public.activity_types (name, name_ar, description, description_ar, points, mode)
            VALUES ('Caravan', 'قافلة', 'Participation in a caravan', 'المشاركة في قافلة', 5, 'group')
            RETURNING id, points INTO v_activity_type_id, v_points;
        END IF;

        -- Fallback committee
        IF v_committee_id IS NULL THEN
            SELECT committee_id INTO v_committee_id FROM public.profiles WHERE id = NEW.volunteer_id;
        END IF;

        SELECT name INTO v_caravan_name FROM public.caravans WHERE id = NEW.caravan_id;

        INSERT INTO public.activity_submissions (
            participant_type, volunteer_id, activity_type_id, committee_id,
            description, status, points_awarded, wore_vest, submitted_at
        ) VALUES (
            'volunteer', NEW.volunteer_id, v_activity_type_id, v_committee_id,
            'قافلة: ' || COALESCE(v_caravan_name, 'Unknown'),
            'approved', COALESCE(v_points, 5), NEW.wore_vest, NOW()
        );
    END IF;
    RETURN NEW;
END;
$$;

-- Function 2: Guest (FIXED to strict NULL volunteer_id)
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
    IF NEW.is_volunteer = FALSE THEN
        SELECT name INTO v_caravan_name FROM public.caravans WHERE id = NEW.caravan_id;

        SELECT id, points, committee_id INTO v_activity_type_id, v_points, v_committee_id
        FROM public.activity_types WHERE LOWER(name) = 'caravan' LIMIT 1;

        IF v_activity_type_id IS NOT NULL THEN
            INSERT INTO public.activity_submissions (
                participant_type,
                volunteer_id, -- EXPLICIT NULL
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
                NULL, -- Guest has no volunteer_id
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

-- 4. Re-create Triggers
CREATE TRIGGER on_volunteer_caravan_participant_added
    AFTER INSERT ON public.caravan_participants
    FOR EACH ROW WHEN (NEW.is_volunteer = TRUE)
    EXECUTE FUNCTION public.log_volunteer_caravan_participation();

CREATE TRIGGER on_guest_caravan_participant_added
    AFTER INSERT ON public.caravan_participants
    FOR EACH ROW WHEN (NEW.is_volunteer = FALSE)
    EXECUTE FUNCTION public.log_guest_caravan_participation();

-- 5. DATA CLEANUP (Attempt to fix existing corrupted records)

-- Fix 1: Ensure any submission with participant_type='guest' has NULL volunteer_id
UPDATE public.activity_submissions
SET volunteer_id = NULL
WHERE participant_type = 'guest' AND volunteer_id IS NOT NULL;

-- Fix 2: If there are records description starting with 'ضيف في قافلة' but marked as volunteer, fix them
UPDATE public.activity_submissions
SET 
  participant_type = 'guest',
  volunteer_id = NULL,
  -- Try to extract guest name from description if possible, or leave it to be filled manually? 
  -- We can't recover guest_name easily if it wasn't saved.
  -- But usually if it was saved via the guest trigger (even if buggy), guest_name might be there?
  guest_name = CASE WHEN guest_name IS NULL THEN 'Guest (Auto-fixed)' ELSE guest_name END
WHERE 
  description LIKE 'ضيف في قافلة%' 
  AND participant_type != 'guest';

