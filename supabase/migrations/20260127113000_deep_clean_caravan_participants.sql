-- =========================================================
-- DEEP CLEAN & REGENERATE: Fix Corrupted Guest Data
-- =========================================================
-- Problem: Guests were saved in 'caravan_participants' as Volunteers (is_volunteer=true) 
-- linked to a Trainer/Volunteer ID (e.g. Nouran).
--
-- Solution:
-- 1. Identify participants where the 'name' does NOT match the linked Profile name.
-- 2. Convert them to Guests (is_volunteer=false, volunteer_id=NULL).
-- 3. Wipe and Regenerate all submissions.

-- Step 1: Drop Triggers to allow bulk updates without side effects
DROP TRIGGER IF EXISTS on_caravan_participant_added ON public.caravan_participants;
DROP TRIGGER IF EXISTS on_volunteer_caravan_participant_added ON public.caravan_participants;
DROP TRIGGER IF EXISTS on_guest_caravan_participant_added ON public.caravan_participants;

-- Step 2: Fix Corrupted 'caravan_participants'
-- Set is_volunteer=FALSE and volunteer_id=NULL where names mismatch
UPDATE public.caravan_participants cp
SET 
  is_volunteer = FALSE,
  volunteer_id = NULL
FROM public.profiles p
WHERE 
  cp.volunteer_id = p.id 
  AND cp.is_volunteer = TRUE
  -- Name mismatch check (allow for simple case/trim differences)
  AND TRIM(BOTH FROM cp.name) NOT ILIKE TRIM(BOTH FROM p.full_name)
  AND (p.full_name_ar IS NULL OR TRIM(BOTH FROM cp.name) NOT ILIKE TRIM(BOTH FROM p.full_name_ar));

-- Step 3: Wipe Submissions (Same as before)
DELETE FROM public.activity_submissions 
WHERE description LIKE 'Caravan: %' 
   OR description LIKE 'قافلة: %'
   OR description LIKE 'Guest in caravan: %'
   OR description LIKE 'ضيف في قافلة: %';

-- Step 4: Regenerate VOLUNTEERS
INSERT INTO public.activity_submissions (
    participant_type, volunteer_id, activity_type_id, committee_id, description, status, points_awarded, wore_vest, submitted_at, created_at
)
SELECT 
    'volunteer', cp.volunteer_id,
    (SELECT id FROM public.activity_types WHERE LOWER(name) = 'caravan' LIMIT 1),
    COALESCE((SELECT committee_id FROM public.profiles WHERE id = cp.volunteer_id), (SELECT id FROM public.committees WHERE name = 'Caravans' LIMIT 1)),
    'قافلة: ' || c.name, 'approved', 5, cp.wore_vest, c.date::timestamp, NOW()
FROM public.caravan_participants cp
JOIN public.caravans c ON cp.caravan_id = c.id
WHERE cp.is_volunteer = TRUE AND cp.volunteer_id IS NOT NULL;

-- Step 5: Regenerate GUESTS
INSERT INTO public.activity_submissions (
    participant_type, volunteer_id, guest_name, guest_phone, activity_type_id, committee_id, description, status, points_awarded, submitted_at, created_at
)
SELECT 
    'guest', NULL, cp.name, cp.phone,
    (SELECT id FROM public.activity_types WHERE LOWER(name) = 'caravan' LIMIT 1),
    (SELECT id FROM public.committees WHERE name = 'Caravans' LIMIT 1),
    'ضيف في قافلة: ' || c.name, 'approved', 0, c.date::timestamp, NOW()
FROM public.caravan_participants cp
JOIN public.caravans c ON cp.caravan_id = c.id
WHERE cp.is_volunteer = FALSE;

-- Step 6: Restore Triggers
CREATE OR REPLACE FUNCTION public.log_volunteer_caravan_participation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_type_id UUID; v_comm_id UUID; v_cname TEXT;
BEGIN
    IF NEW.is_volunteer = TRUE AND NEW.volunteer_id IS NOT NULL THEN
        SELECT id, committee_id INTO v_type_id, v_comm_id FROM public.activity_types WHERE LOWER(name) = 'caravan' LIMIT 1;
        IF v_comm_id IS NULL THEN SELECT committee_id INTO v_comm_id FROM public.profiles WHERE id = NEW.volunteer_id; END IF;
        SELECT name INTO v_cname FROM public.caravans WHERE id = NEW.caravan_id;
        INSERT INTO public.activity_submissions (
            participant_type, volunteer_id, activity_type_id, committee_id, description, status, points_awarded, wore_vest, submitted_at
        ) VALUES (
            'volunteer', NEW.volunteer_id, v_type_id, v_comm_id, 'قافلة: ' || v_cname, 'approved', 5, NEW.wore_vest, NOW()
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_guest_caravan_participation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_type_id UUID; v_comm_id UUID; v_cname TEXT;
BEGIN
    IF NEW.is_volunteer = FALSE THEN
        SELECT id, committee_id INTO v_type_id, v_comm_id FROM public.activity_types WHERE LOWER(name) = 'caravan' LIMIT 1;
        SELECT name INTO v_cname FROM public.caravans WHERE id = NEW.caravan_id;
        INSERT INTO public.activity_submissions (
            participant_type, volunteer_id, guest_name, guest_phone, activity_type_id, committee_id, description, status, points_awarded, submitted_at
        ) VALUES (
            'guest', NULL, NEW.name, NEW.phone, v_type_id, v_comm_id, 'ضيف في قافلة: ' || v_cname, 'approved', 0, NOW()
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_volunteer_caravan_participant_added AFTER INSERT ON public.caravan_participants
    FOR EACH ROW WHEN (NEW.is_volunteer = TRUE) EXECUTE FUNCTION public.log_volunteer_caravan_participation();

CREATE TRIGGER on_guest_caravan_participant_added AFTER INSERT ON public.caravan_participants
    FOR EACH ROW WHEN (NEW.is_volunteer = FALSE) EXECUTE FUNCTION public.log_guest_caravan_participation();
