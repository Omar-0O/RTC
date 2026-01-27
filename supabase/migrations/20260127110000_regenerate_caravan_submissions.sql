-- =========================================================
-- ULTIMATE FIX: Regenerate Caravan Submissions
-- =========================================================
-- This script will:
-- 1. DROP all existing caravan-related submissions (to clean up corruption).
-- 2. RE-INSERT submissions based on the 'caravan_participants' table (the source of truth).
-- 3. Ensure 'volunteer_id' is nullable and triggers are correct.

-- Step 1: Ensure Schema allows NULL volunteer_id
ALTER TABLE public.activity_submissions ALTER COLUMN volunteer_id DROP NOT NULL;

-- Step 2: Drop Triggers temporarily to prevent double-insertion during regeneration
DROP TRIGGER IF EXISTS on_caravan_participant_added ON public.caravan_participants;
DROP TRIGGER IF EXISTS on_volunteer_caravan_participant_added ON public.caravan_participants;
DROP TRIGGER IF EXISTS on_guest_caravan_participant_added ON public.caravan_participants;

-- Step 3: Delete ALL caravan submissions (Clean Slate)
-- We identify them by description or committee. Safer to use description pattern.
DELETE FROM public.activity_submissions 
WHERE description LIKE 'Caravan: %' 
   OR description LIKE 'قافلة: %'
   OR description LIKE 'Guest in caravan: %'
   OR description LIKE 'ضيف في قافلة: %';

-- Step 4: Regenerate Submissions for VOLUNTEERS
INSERT INTO public.activity_submissions (
    participant_type,
    volunteer_id,
    activity_type_id,
    committee_id,
    description,
    status,
    points_awarded,
    wore_vest,
    submitted_at,
    created_at
)
SELECT 
    'volunteer',
    cp.volunteer_id,
    (SELECT id FROM public.activity_types WHERE LOWER(name) = 'caravan' LIMIT 1),
    COALESCE(
        (SELECT committee_id FROM public.profiles WHERE id = cp.volunteer_id), 
        (SELECT id FROM public.committees WHERE name = 'Caravans' LIMIT 1)
    ),
    'قافلة: ' || c.name,
    'approved',
    5, -- Default points
    cp.wore_vest,
    c.date::timestamp, -- Use Caravan Date as submission date
    NOW()
FROM public.caravan_participants cp
JOIN public.caravans c ON cp.caravan_id = c.id
WHERE cp.is_volunteer = TRUE AND cp.volunteer_id IS NOT NULL;

-- Step 5: Regenerate Submissions for GUESTS
INSERT INTO public.activity_submissions (
    participant_type,
    volunteer_id,
    guest_name,
    guest_phone,
    activity_type_id,
    committee_id,
    description,
    status,
    points_awarded,
    submitted_at,
    created_at
)
SELECT 
    'guest',
    NULL, -- Explicit NULL
    cp.name,
    cp.phone,
    (SELECT id FROM public.activity_types WHERE LOWER(name) = 'caravan' LIMIT 1),
    (SELECT id FROM public.committees WHERE name = 'Caravans' LIMIT 1),
    'ضيف في قافلة: ' || c.name,
    'approved',
    0, -- Guests usually get 0 points, or 5? Let's check logic. Usually 0.
    c.date::timestamp,
    NOW()
FROM public.caravan_participants cp
JOIN public.caravans c ON cp.caravan_id = c.id
WHERE cp.is_volunteer = FALSE;

-- Step 6: Restore Correct Triggers (Optimized)

CREATE OR REPLACE FUNCTION public.log_volunteer_caravan_participation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_type_id UUID; v_comm_id UUID; v_cname TEXT;
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
DECLARE
    v_type_id UUID; v_comm_id UUID; v_cname TEXT;
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

CREATE TRIGGER on_volunteer_caravan_participant_added
    AFTER INSERT ON public.caravan_participants
    FOR EACH ROW WHEN (NEW.is_volunteer = TRUE)
    EXECUTE FUNCTION public.log_volunteer_caravan_participation();

CREATE TRIGGER on_guest_caravan_participant_added
    AFTER INSERT ON public.caravan_participants
    FOR EACH ROW WHEN (NEW.is_volunteer = FALSE)
    EXECUTE FUNCTION public.log_guest_caravan_participation();

