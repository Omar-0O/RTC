-- ═══════════════════════════════════════════════════════════════════════════
-- Fix 1: Set source_circle_id for quran entries that still have NULL
--   Try quran_circle_beneficiaries first, then quran_enrollments as fallback
-- ═══════════════════════════════════════════════════════════════════════════


-- Attempt 1: via quran_circle_beneficiaries (session attendance)
UPDATE public.interested_beneficiaries ib
SET source_circle_id = (
    SELECT qcb.circle_id
    FROM public.quran_beneficiaries qb
    JOIN public.quran_circle_beneficiaries qcb ON qcb.beneficiary_id = qb.id
    WHERE qb.phone = ib.phone
    ORDER BY qcb.created_at DESC
    LIMIT 1
)
WHERE ib.committee_category = 'quran'
  AND ib.source_course_id IS NULL
  AND ib.source_circle_id IS NULL;

-- Attempt 2: via quran_enrollments (formal enrollment — more reliable)
UPDATE public.interested_beneficiaries ib
SET source_circle_id = (
    SELECT e.circle_id
    FROM public.quran_beneficiaries qb
    JOIN public.quran_enrollments e ON e.beneficiary_id = qb.id
    WHERE qb.phone = ib.phone
    ORDER BY e.enrollment_date DESC
    LIMIT 1
)
WHERE ib.committee_category = 'quran'
  AND ib.source_course_id IS NULL
  AND ib.source_circle_id IS NULL;  -- only those still NULL after attempt 1

-- ═══════════════════════════════════════════════════════════════════════════
-- Fix 2: Classify gender_age_group for all quran entries still in "غير مصنف"
--   Uses gender + beneficiary_type from quran_beneficiaries matched by phone
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.interested_beneficiaries ib
SET gender_age_group = (
    SELECT CASE
        WHEN qb.beneficiary_type = 'adult' AND qb.gender = 'male'   THEN 'adult_male'
        WHEN qb.beneficiary_type = 'adult' AND qb.gender = 'female' THEN 'adult_female'
        WHEN qb.beneficiary_type = 'child' AND qb.gender = 'male'   THEN 'child_male'
        WHEN qb.beneficiary_type = 'child' AND qb.gender = 'female' THEN 'child_female'
        ELSE NULL
    END
    FROM public.quran_beneficiaries qb
    WHERE qb.phone = ib.phone
    LIMIT 1
)
WHERE ib.committee_category = 'quran'
  AND ib.gender_age_group IS NULL;
