-- Create a function to get the leaderboard with time filters
CREATE OR REPLACE FUNCTION public.get_leaderboard(
  period_type TEXT, 
  target_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  committee_filter UUID DEFAULT NULL
)
RETURNS TABLE (
  volunteer_id UUID,
  full_name TEXT,
  full_name_ar TEXT,
  avatar_url TEXT,
  total_points BIGINT,
  activities_count BIGINT,
  level public.volunteer_level,
  committee_id UUID,
  committee_name TEXT,
  committee_name_ar TEXT
) AS $$
DECLARE
  start_date TIMESTAMP WITH TIME ZONE;
  end_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Determine start and end dates based on period_type
  IF period_type = 'month' THEN
    start_date := date_trunc('month', target_date);
    end_date := date_trunc('month', target_date) + interval '1 month' - interval '1 second';
  ELSIF period_type = 'quarter' THEN
    start_date := date_trunc('quarter', target_date);
    end_date := date_trunc('quarter', target_date) + interval '3 months' - interval '1 second';
  ELSIF period_type = 'half_year' THEN
    IF date_part('month', target_date) <= 6 THEN
      start_date := date_trunc('year', target_date);
      end_date := date_trunc('year', target_date) + interval '6 months' - interval '1 second';
    ELSE
      start_date := date_trunc('year', target_date) + interval '6 months';
      end_date := date_trunc('year', target_date) + interval '1 year' - interval '1 second';
    END IF;
  ELSIF period_type = 'year' THEN
    start_date := date_trunc('year', target_date);
    end_date := date_trunc('year', target_date) + interval '1 year' - interval '1 second';
  ELSE
    -- 'all_time' or invalid, no date filter
    start_date := NULL;
    end_date := NULL;
  END IF;

  RETURN QUERY
  SELECT
    p.id AS volunteer_id,
    p.full_name,
    p.full_name_ar,
    p.avatar_url,
    COALESCE(SUM(s.points_awarded), 0) AS total_points,
    COUNT(s.id) AS activities_count,
    p.level,
    p.committee_id,
    c.name AS committee_name,
    c.name_ar AS committee_name_ar
  FROM
    public.profiles p
  LEFT JOIN
    public.activity_submissions s ON p.id = s.volunteer_id 
      AND s.status = 'approved'
      AND (start_date IS NULL OR s.submitted_at BETWEEN start_date AND end_date)
  LEFT JOIN
    public.committees c ON p.committee_id = c.id
  WHERE
    (committee_filter IS NULL OR p.committee_id = committee_filter)
    -- Exclude admins and other roles if needed
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur_admin 
      WHERE ur_admin.user_id = p.id AND ur_admin.role = 'admin'
    )
  GROUP BY
    p.id, p.full_name, p.full_name_ar, p.avatar_url, p.level, p.committee_id, c.name, c.name_ar
  HAVING
    (COALESCE(SUM(s.points_awarded), 0) > 0 OR period_type = 'all_time')
  ORDER BY
    total_points DESC,
    activities_count DESC;
END;
$$ LANGUAGE plpgsql STABLE;
