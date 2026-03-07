-- 1. Add 'fourth_year' to the committee_category check constraint
-- We need to drop the existing check constraint and add a new one allowing 'fourth_year'
ALTER TABLE public.interested_beneficiaries
DROP CONSTRAINT if exists interested_beneficiaries_committee_category_check;

ALTER TABLE public.interested_beneficiaries
ADD CONSTRAINT interested_beneficiaries_committee_category_check 
CHECK (committee_category IN ('production', 'quran', 'fourth_year'));

-- 2. Update the trigger public.sync_caravan_guest_to_interested()
-- To insert guests with committee_category = 'fourth_year' instead of 'production'
CREATE OR REPLACE FUNCTION public.sync_caravan_guest_to_interested()
RETURNS TRIGGER AS $$
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
                'fourth_year',
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Migrate existing "Caravan" interested beneficiaries to 'fourth_year'
DO $$
DECLARE
    v_caravans_committee_id UUID;
BEGIN
    -- Fetch the Caravans committee ID
    SELECT id INTO v_caravans_committee_id
    FROM public.committees
    WHERE name = 'Caravans' OR name_ar = 'لجنة القوافل'
    LIMIT 1;

    -- Update existing records from 'production' to 'fourth_year'
    IF v_caravans_committee_id IS NOT NULL THEN
        UPDATE public.interested_beneficiaries
        SET committee_category = 'fourth_year'
        WHERE production_committee_id = v_caravans_committee_id;
    END IF;
END $$;
