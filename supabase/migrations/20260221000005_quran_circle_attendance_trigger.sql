-- Improved trigger: uses gender + beneficiary_type from quran_beneficiaries
-- to auto-classify into gender_age_group instead of defaulting to NULL (غير مصنف)
--
-- Mapping:
--   adult + male   → adult_male
--   adult + female → adult_female
--   child + male   → child_male
--   child + female → child_female
--   (NULL gender or type) → NULL → غير مصنف

CREATE OR REPLACE FUNCTION public.sync_quran_circle_attendance_to_interested()
RETURNS TRIGGER AS $$
DECLARE
    v_name           TEXT;
    v_phone          TEXT;
    v_gender         TEXT;
    v_type           TEXT;
    v_created_by     UUID;
    v_gender_group   TEXT;
BEGIN
    SELECT name_ar, phone, gender, beneficiary_type, created_by
    INTO v_name, v_phone, v_gender, v_type, v_created_by
    FROM public.quran_beneficiaries
    WHERE id = NEW.beneficiary_id;

    IF v_phone IS NULL THEN
        RETURN NEW;
    END IF;

    -- Map gender + beneficiary_type → gender_age_group
    v_gender_group := CASE
        WHEN v_type = 'adult' AND v_gender = 'male'   THEN 'adult_male'
        WHEN v_type = 'adult' AND v_gender = 'female' THEN 'adult_female'
        WHEN v_type = 'child' AND v_gender = 'male'   THEN 'child_male'
        WHEN v_type = 'child' AND v_gender = 'female' THEN 'child_female'
        ELSE NULL  -- missing data → غير مصنف
    END;

    INSERT INTO public.interested_beneficiaries
        (name, phone, committee_category, gender_age_group, source_circle_id, created_by)
    VALUES (
        v_name,
        v_phone,
        'quran',
        v_gender_group,
        NEW.circle_id,
        v_created_by
    )
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_quran_circle_attendance ON public.quran_circle_beneficiaries;
CREATE TRIGGER on_quran_circle_attendance
    AFTER INSERT ON public.quran_circle_beneficiaries
    FOR EACH ROW EXECUTE FUNCTION public.sync_quran_circle_attendance_to_interested();
