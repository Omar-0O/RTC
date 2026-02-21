-- Add production_committee_id to link beneficiaries to a specific production committee
ALTER TABLE public.interested_beneficiaries
    ADD COLUMN IF NOT EXISTS production_committee_id UUID REFERENCES public.committees(id) ON DELETE SET NULL;

-- Update unique constraint to include production_committee_id
-- so the same person can appear under multiple production committees
DROP INDEX IF EXISTS interested_beneficiaries_unique_idx;
CREATE UNIQUE INDEX interested_beneficiaries_unique_idx
ON public.interested_beneficiaries(
    phone,
    committee_category,
    COALESCE(gender_age_group, ''),
    COALESCE(production_committee_id::text, '')
);

-- Update the trigger: all course_beneficiaries → 'production'
-- (quran circle attendees live in quran_beneficiaries, not course_beneficiaries)
CREATE OR REPLACE FUNCTION public.sync_course_beneficiary_to_interested()
RETURNS TRIGGER AS $$
DECLARE
    v_committee_id UUID;
BEGIN
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
