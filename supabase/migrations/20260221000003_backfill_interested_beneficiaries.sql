-- ═══════════════════════════════════════════════════════════════════════════
-- Backfill: copy ALL existing beneficiaries into interested_beneficiaries
--
-- Source 1: course_beneficiaries  → always 'production' (with committee)
-- Source 2: quran_beneficiaries   → always 'quran'  (gender_age_group = NULL → غير مصنف)
-- Conflicts are silently ignored (ON CONFLICT DO NOTHING)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. From course_beneficiaries → production ───────────────────────────────

INSERT INTO public.interested_beneficiaries
    (name, phone, committee_category, gender_age_group, production_committee_id, source_course_id, created_by)
SELECT
    cb.name,
    cb.phone,
    'production'        AS committee_category,
    NULL                AS gender_age_group,
    c.committee_id      AS production_committee_id,
    cb.course_id        AS source_course_id,
    cb.created_by
FROM public.course_beneficiaries cb
JOIN public.courses c ON c.id = cb.course_id
ON CONFLICT DO NOTHING;

-- ─── 2. From quran_beneficiaries → quran (غير مصنف) ─────────────────────────
-- No gender column exists → all land in "غير مصنف", admin classifies manually

INSERT INTO public.interested_beneficiaries
    (name, phone, committee_category, gender_age_group, production_committee_id, source_course_id, created_by)
SELECT
    qb.name_ar,
    qb.phone,
    'quran'  AS committee_category,
    NULL     AS gender_age_group,
    NULL     AS production_committee_id,
    NULL     AS source_course_id,
    qb.created_by
FROM public.quran_beneficiaries qb
ON CONFLICT DO NOTHING;
