-- Restore Ethics Publishing Activity Type

DO $$
DECLARE
    v_activity_type_id UUID;
    v_committee_id UUID := '722d7feb-0b46-48a8-8652-75c1e1a8487a'; -- Ethics Committee ID
BEGIN
    
    -- 1. Ensure 'Ethics Publishing' Activity Type exists
    SELECT id INTO v_activity_type_id
    FROM public.activity_types
    WHERE name = 'Ethics Publishing';

    IF v_activity_type_id IS NULL THEN
        INSERT INTO public.activity_types (
            name,
            name_ar,
            description,
            description_ar,
            points,
            mode,
            committee_id
        ) VALUES (
            'Ethics Publishing',
            'نشر اخلاقيات',
            'Participation in ethics calls outreach',
            'المشاركة في نزولات نشر الاخلاقيات',
            10,
            'group',
            v_committee_id
        );
        RAISE NOTICE 'Restored Ethics Publishing activity type.';
    ELSE
        -- Update the committee_id just in case it was wrong/missing
        UPDATE public.activity_types
        SET 
            committee_id = v_committee_id,
            points = 10 -- Ensure points are correct
        WHERE id = v_activity_type_id;
    END IF;
END $$;
