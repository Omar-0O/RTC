-- All course_beneficiaries map to 'production'.
-- Quran circle attendees are in quran_beneficiaries (separate table), not here.
CREATE OR REPLACE FUNCTION public.sync_course_beneficiary_to_interested()
RETURNS TRIGGER AS $$
DECLARE
    v_committee_id UUID;
BEGIN
    -- Get the course's committee (for production_committee_id)
    SELECT committee_id INTO v_committee_id
    FROM public.courses WHERE id = NEW.course_id;

    INSERT INTO public.interested_beneficiaries
        (name, phone, committee_category, gender_age_group, production_committee_id, source_course_id, created_by)
    VALUES (
        NEW.name,
        NEW.phone,
        'production',
        NULL,
        v_committee_id,
        NEW.course_id,
        NEW.created_by
    )
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;