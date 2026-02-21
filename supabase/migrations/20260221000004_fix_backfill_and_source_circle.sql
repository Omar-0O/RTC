-- ═══════════════════════════════════════════════════════════════════════════
-- Fix: two issues from previous migrations
--   1. Add source_circle_id for quran beneficiaries (shows source instead of "يدوي")
--   2. Update production entries where production_committee_id is still NULL
--   3. Re-run any missed backfill rows safely (ON CONFLICT DO NOTHING)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Add source_circle_id column ──────────────────────────────────────────
ALTER TABLE public.interested_beneficiaries
    ADD COLUMN IF NOT EXISTS source_circle_id UUID REFERENCES public.quran_circles(id) ON DELETE SET NULL;

-- ─── 2. Fix production_committee_id for existing entries that are still NULL ──
-- Happens when backfill ran before migration 20260221000002 was applied
UPDATE public.interested_beneficiaries ib
SET production_committee_id = c.committee_id
FROM public.courses c
WHERE ib.source_course_id = c.id
  AND ib.committee_category = 'production'
  AND ib.production_committee_id IS NULL;

-- ─── 3. Set source_circle_id for quran entries from backfill ─────────────────
-- Matches by phone number to find any circle the quran beneficiary belongs to
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

-- ─── 4. Re-run backfill for any missed course_beneficiaries ──────────────────
INSERT INTO public.interested_beneficiaries
    (name, phone, committee_category, gender_age_group, production_committee_id, source_course_id, created_by)
SELECT
    cb.name,
    cb.phone,
    'production',
    NULL,
    c.committee_id,
    cb.course_id,
    cb.created_by
FROM public.course_beneficiaries cb
JOIN public.courses c ON c.id = cb.course_id
ON CONFLICT DO NOTHING;

-- ─── 5. Re-run backfill for any missed quran_beneficiaries ───────────────────
-- We use a CTE to get one circle per beneficiary (most recent)
WITH quran_with_circle AS (
    SELECT DISTINCT ON (qb.id)
        qb.id,
        qb.name_ar,
        qb.phone,
        qb.created_by,
        qcb.circle_id
    FROM public.quran_beneficiaries qb
    LEFT JOIN public.quran_circle_beneficiaries qcb ON qcb.beneficiary_id = qb.id
    ORDER BY qb.id, qcb.created_at DESC
)
INSERT INTO public.interested_beneficiaries
    (name, phone, committee_category, gender_age_group, production_committee_id, source_circle_id, source_course_id, created_by)
SELECT
    qwc.name_ar,
    qwc.phone,
    'quran',
    NULL,
    NULL,
    qwc.circle_id,
    NULL,
    qwc.created_by
FROM quran_with_circle qwc
ON CONFLICT DO NOTHING;
