-- Migrations to add caravan guests to interested beneficiaries automatically

-- 1. Create a trigger function to keep interested beneficiaries synced with new caravan guests
CREATE OR REPLACE FUNCTION public.sync_caravan_guest_to_interested()
RETURNS TRIGGER AS 
DECLARE
    v_caravans_committee_id UUID;
    v_caravan_created_by UUID;
BEGIN
    -- Only process non-volunteers (guests) who have a phone number
    IF NEW.is_volunteer = false AND NEW.phone IS NOT NULL AND TRIM(NEW.phone) != '' THEN

        -- Fetch the Caravans committee ID
        SELECT id INTO v_caravans_committee_id
        FROM public.committees
        WHERE name = 'Caravans' OR name_ar = 'لجنة القوافل'
        LIMIT 1;

        -- Fetch the caravan's creator 
        SELECT created_by INTO v_caravan_created_by
        FROM public.caravans
        WHERE id = NEW.caravan_id;

        -- Insert into interested_beneficiaries
        IF v_caravans_committee_id IS NOT NULL THEN
            INSERT INTO public.interested_beneficiaries (
                name,
                phone,
                committee_category,
                gender_age_group,
                production_committee_id,
                notes,
                created_by
            )
            VALUES (
                NEW.name,
                NEW.phone,
                'production',
                NULL,
                v_caravans_committee_id,
                'ضيف في قافلة',
                v_caravan_created_by
            )
            -- If a person with the same phone already exists in this category, we ignore to prevent duplicates
            ON CONFLICT (phone, committee_category, COALESCE(gender_age_group, ''), COALESCE(production_committee_id::text, '')) DO NOTHING;
        END IF;
    END IF;

    RETURN NEW;
END;
 LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Attach the trigger to the caravan_participants table
DROP TRIGGER IF EXISTS on_caravan_participant_guest_added ON public.caravan_participants;
CREATE TRIGGER on_caravan_participant_guest_added
    AFTER INSERT OR UPDATE ON public.caravan_participants
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_caravan_guest_to_interested();


-- 3. Backfill existing caravan guests into interested_beneficiaries
DO 
DECLARE
    v_caravans_committee_id UUID;
BEGIN
    -- Fetch the Caravans committee ID
    SELECT id INTO v_caravans_committee_id
    FROM public.committees
    WHERE name = 'Caravans' OR name_ar = 'لجنة القوافل'
    LIMIT 1;

    IF v_caravans_committee_id IS NOT NULL THEN
        INSERT INTO public.interested_beneficiaries (
            name,
            phone,
            committee_category,
            gender_age_group,
            production_committee_id,
            notes,
            created_by
        )
        SELECT 
            cp.name,
            cp.phone,
            'production',
            NULL,
            v_caravans_committee_id,
            'ضيف في قافلة',
            c.created_by
        FROM 
            public.caravan_participants cp
        JOIN 
            public.caravans c ON c.id = cp.caravan_id
        WHERE 
            cp.is_volunteer = false AND cp.phone IS NOT NULL AND TRIM(cp.phone) != ''
        -- Ensure we don't insert duplicates
        ON CONFLICT (phone, committee_category, COALESCE(gender_age_group, ''), COALESCE(production_committee_id::text, '')) DO NOTHING;
    END IF;
END ;