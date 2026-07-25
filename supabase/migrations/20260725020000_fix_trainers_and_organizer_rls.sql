-- ============================================================================
-- Fix 1: Re-apply list_trainers_with_stats RPC (404 if missing from DB)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.list_trainers_with_stats(
  p_committee_id UUID DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL,
  p_today DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  id UUID,
  name_en TEXT,
  name_ar TEXT,
  phone TEXT,
  image_url TEXT,
  specialization TEXT,
  committee_id UUID,
  user_id UUID,
  created_at TIMESTAMPTZ,
  join_date DATE,
  branch_id UUID,
  committee_name TEXT,
  committee_name_ar TEXT,
  linked_user_full_name TEXT,
  linked_user_email TEXT,
  courses_count INTEGER,
  completed_courses_count INTEGER,
  certificates_delivered_count INTEGER,
  is_active BOOLEAN
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH trainer_courses AS (
    SELECT ct.trainer_id, c.id AS course_id, c.end_date, c.has_certificates, c.certificate_status
    FROM public.course_trainers ct
    JOIN public.courses c ON c.id = ct.course_id

    UNION

    SELECT c.trainer_id, c.id AS course_id, c.end_date, c.has_certificates, c.certificate_status
    FROM public.courses c
    WHERE c.trainer_id IS NOT NULL
  )
  SELECT
    t.id,
    t.name_en,
    t.name_ar,
    t.phone,
    t.image_url,
    t.specialization,
    t.committee_id,
    t.user_id,
    t.created_at,
    t.join_date,
    t.branch_id,
    c.name AS committee_name,
    c.name_ar AS committee_name_ar,
    p.full_name AS linked_user_full_name,
    p.email AS linked_user_email,
    COUNT(DISTINCT tc.course_id)::INTEGER AS courses_count,
    COUNT(DISTINCT tc.course_id) FILTER (WHERE tc.end_date < p_today)::INTEGER AS completed_courses_count,
    COUNT(DISTINCT tc.course_id) FILTER (
      WHERE tc.has_certificates = TRUE
        AND tc.certificate_status = 'delivered'
    )::INTEGER AS certificates_delivered_count,
    COALESCE(BOOL_OR(tc.end_date >= p_today), FALSE) AS is_active
  FROM public.trainers t
  LEFT JOIN public.committees c ON c.id = t.committee_id
  LEFT JOIN public.profiles p ON p.id = t.user_id
  LEFT JOIN trainer_courses tc ON tc.trainer_id = t.id
  WHERE (p_committee_id IS NULL OR t.committee_id = p_committee_id)
    AND (p_branch_id IS NULL OR t.branch_id = p_branch_id)
  GROUP BY
    t.id,
    t.name_en,
    t.name_ar,
    t.phone,
    t.image_url,
    t.specialization,
    t.committee_id,
    t.user_id,
    t.created_at,
    t.join_date,
    t.branch_id,
    c.name,
    c.name_ar,
    p.full_name,
    p.email
  ORDER BY t.name_ar;
$$;

GRANT EXECUTE ON FUNCTION public.list_trainers_with_stats(UUID, UUID, DATE) TO authenticated;

-- ============================================================================
-- Fix 2: quran_circle_organizers SELECT policy
-- Allow organizers to ALWAYS see their own rows (even if branch_id not set).
-- The old policy relied solely on branch matching which failed when the
-- volunteer's profile had no branch_id (get_my_branch_id() returns NULL).
-- ============================================================================

DROP POLICY IF EXISTS quran_circle_organizers_select ON public.quran_circle_organizers;

CREATE POLICY quran_circle_organizers_select
  ON public.quran_circle_organizers
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_exec()
    OR volunteer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.quran_circles c
      WHERE c.id = circle_id
        AND c.branch_id = public.get_my_branch_id()
    )
  );

-- ============================================================================
-- Fix 3: quran_circle_marketers SELECT policy (same issue)
-- ============================================================================

DROP POLICY IF EXISTS quran_circle_marketers_select ON public.quran_circle_marketers;

CREATE POLICY quran_circle_marketers_select
  ON public.quran_circle_marketers
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_exec()
    OR volunteer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.quran_circles c
      WHERE c.id = circle_id
        AND c.branch_id = public.get_my_branch_id()
    )
  );
