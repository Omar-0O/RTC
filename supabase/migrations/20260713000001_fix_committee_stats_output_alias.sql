-- Repair the output-column ambiguity in the preceding hardening migration.

CREATE OR REPLACE FUNCTION public.get_committees_with_stats(
  p_start_date text DEFAULT NULL,
  p_end_date text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  name_ar text,
  description text,
  description_ar text,
  color text,
  committee_type text,
  volunteer_count bigint,
  trainer_count bigint,
  total_points bigint,
  participation_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $hardening$
DECLARE
  requester_id uuid := auth.uid();
  requester_branch uuid;
  is_global_admin boolean;
  start_at timestamptz;
  end_at timestamptz;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  start_at := NULLIF(p_start_date, '')::timestamptz;
  end_at := NULLIF(p_end_date, '')::timestamptz;

  IF start_at IS NOT NULL AND end_at IS NOT NULL AND start_at > end_at THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  SELECT profile.branch_id
  INTO requester_branch
  FROM public.profiles profile
  WHERE profile.id = requester_id;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = requester_id
      AND role::text IN ('admin', 'executive')
  )
  INTO is_global_admin;

  IF NOT is_global_admin
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = requester_id
        AND role::text IN ('supervisor', 'branch_admin', 'head_hr')
    ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF NOT is_global_admin AND requester_branch IS NULL THEN
    RAISE EXCEPTION 'Requester branch is required';
  END IF;

  RETURN QUERY
  WITH volunteer_counts AS (
    SELECT profile.committee_id, count(*) AS count
    FROM public.profiles profile
    WHERE profile.committee_id IS NOT NULL
      AND (is_global_admin OR profile.branch_id = requester_branch)
    GROUP BY profile.committee_id
  ),
  trainer_counts AS (
    SELECT trainer.committee_id, count(*) AS count
    FROM public.trainers trainer
    WHERE trainer.committee_id IS NOT NULL
      AND (is_global_admin OR trainer.branch_id = requester_branch)
    GROUP BY trainer.committee_id
  ),
  activity_stats AS (
    SELECT submission.committee_id,
      count(*) AS participation_count,
      COALESCE(sum(submission.points_awarded), 0) AS points_total
    FROM public.activity_submissions submission
    WHERE submission.committee_id IS NOT NULL
      AND submission.status = 'approved'
      AND (start_at IS NULL OR submission.submitted_at >= start_at)
      AND (end_at IS NULL OR submission.submitted_at <= end_at)
      AND (is_global_admin OR submission.branch_id = requester_branch)
    GROUP BY submission.committee_id
  )
  SELECT
    committee.id,
    committee.name,
    committee.name_ar,
    committee.description,
    committee.description_ar,
    committee.color,
    committee.committee_type,
    COALESCE(volunteer_counts.count, 0),
    COALESCE(trainer_counts.count, 0),
    COALESCE(activity_stats.points_total, 0)::bigint,
    COALESCE(activity_stats.participation_count, 0)
  FROM public.committees committee
  LEFT JOIN volunteer_counts ON committee.id = volunteer_counts.committee_id
  LEFT JOIN trainer_counts ON committee.id = trainer_counts.committee_id
  LEFT JOIN activity_stats ON committee.id = activity_stats.committee_id
  WHERE is_global_admin OR committee.branch_id = requester_branch
  ORDER BY committee.name;
END;
$hardening$;

REVOKE ALL ON FUNCTION public.get_committees_with_stats(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_committees_with_stats(text, text) TO authenticated;
