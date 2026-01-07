-- Create Caravans Committee
DO $$
DECLARE
    caravan_committee_id UUID;
BEGIN
    -- 1. Insert or Get 'Caravans' Committee
    INSERT INTO public.committees (name, name_ar, description, description_ar, color)
    VALUES ('Caravans', 'القوافل', 'Committee responsible for organizing caravans.', 'اللجنة المسؤولة عن تنظيم القوافل.', '#F59E0B')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name -- dummy update to get ID
    RETURNING id INTO caravan_committee_id;

    -- If it already existed, we need to fetch the ID
    IF caravan_committee_id IS NULL THEN
        SELECT id INTO caravan_committee_id FROM public.committees WHERE name = 'Caravans';
    END IF;

    -- 2.Update 'Caravan' Activity Type to belong to this committee
    UPDATE public.activity_types
    SET committee_id = caravan_committee_id
    WHERE name = 'Caravan';

END $$;
