-- Migration: Fix Leaderboard RPC and Backfill Missing Participations
-- This migration addresses two issues:
-- 1. The 'third_year' period type was missing from get_leaderboard function
-- 2. Participations created BEFORE triggers were added are not in activity_submissions

-- =============================================
-- PART 1: Update get_leaderboard to support 'third_year'
-- =============================================

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
  current_month INTEGER;
BEGIN
  current_month := date_part('month', target_date);
  
  -- Determine start and end dates based on period_type
  IF period_type = 'month' THEN
    start_date := date_trunc('month', target_date);
    end_date := date_trunc('month', target_date) + interval '1 month' - interval '1 second';
  ELSIF period_type = 'quarter' THEN
    start_date := date_trunc('quarter', target_date);
    end_date := date_trunc('quarter', target_date) + interval '3 months' - interval '1 second';
  ELSIF period_type = 'third_year' THEN
    -- Third of year: Sep-Dec, Jan-Apr, May-Aug
    IF current_month >= 9 THEN
      -- Sep-Dec (first third of academic year)
      start_date := date_trunc('year', target_date) + interval '8 months';
      end_date := date_trunc('year', target_date) + interval '1 year' - interval '1 second';
    ELSIF current_month >= 5 THEN
      -- May-Aug (third third)
      start_date := date_trunc('year', target_date) + interval '4 months';
      end_date := date_trunc('year', target_date) + interval '8 months' - interval '1 second';
    ELSE
      -- Jan-Apr (second third)
      start_date := date_trunc('year', target_date);
      end_date := date_trunc('year', target_date) + interval '4 months' - interval '1 second';
    END IF;
  ELSIF period_type = 'half_year' THEN
    IF current_month <= 6 THEN
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
    -- Exclude admins
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

-- =============================================
-- PART 2: Backfill missing caravan participations
-- Insert submissions for volunteers who participated in caravans but have no corresponding submission
-- =============================================

DO $$
DECLARE
    v_caravan_activity_type_id UUID;
    v_caravans_committee_id UUID := 'e3517d42-3140-4323-bf79-5a6728fc45ef';
    backfill_count INTEGER := 0;
BEGIN
    -- Get Caravan activity type
    SELECT id INTO v_caravan_activity_type_id
    FROM public.activity_types
    WHERE LOWER(name) = 'caravan'
    LIMIT 1;

    -- Only proceed if activity type exists
    IF v_caravan_activity_type_id IS NOT NULL THEN
        -- Insert missing caravan participations
        INSERT INTO public.activity_submissions (
            volunteer_id,
            activity_type_id,
            committee_id,
            description,
            status,
            points_awarded,
            submitted_at
        )
        SELECT 
            cp.volunteer_id,
            v_caravan_activity_type_id,
            v_caravans_committee_id,
            'قافلة: ' || COALESCE(cv.name, 'Unknown') || ' (تسجيل تلقائي)',
            'approved',
            5,
            COALESCE(cp.created_at, cv.date::timestamptz, NOW())
        FROM public.caravan_participants cp
        JOIN public.caravans cv ON cp.caravan_id = cv.id
        WHERE cp.is_volunteer = TRUE
          AND cp.volunteer_id IS NOT NULL
          -- Only insert if no matching submission exists
          AND NOT EXISTS (
              SELECT 1 FROM public.activity_submissions asub
              WHERE asub.volunteer_id = cp.volunteer_id
                AND asub.activity_type_id = v_caravan_activity_type_id
                AND asub.description LIKE '%' || cv.name || '%'
          );
        
        GET DIAGNOSTICS backfill_count = ROW_COUNT;
        RAISE NOTICE 'Backfilled % missing caravan participations', backfill_count;
    END IF;
END $$;

-- =============================================
-- PART 3: Backfill missing event participations
-- =============================================

DO $$
DECLARE
    v_event_activity_type_id UUID;
    v_events_committee_id UUID := 'c82bc5e2-49b1-4951-9f1e-249afeaafeb8';
    backfill_count INTEGER := 0;
BEGIN
    -- Get Event activity type
    SELECT id INTO v_event_activity_type_id
    FROM public.activity_types
    WHERE LOWER(name) = 'event'
    LIMIT 1;

    -- Only proceed if activity type exists
    IF v_event_activity_type_id IS NOT NULL THEN
        -- Insert missing event participations
        INSERT INTO public.activity_submissions (
            volunteer_id,
            activity_type_id,
            committee_id,
            description,
            status,
            points_awarded,
            submitted_at
        )
        SELECT 
            ep.volunteer_id,
            v_event_activity_type_id,
            v_events_committee_id,
            'ايفنت: ' || COALESCE(ev.name, 'Unknown') || ' (تسجيل تلقائي)',
            'approved',
            5,
            COALESCE(ep.created_at, ev.date::timestamptz, NOW())
        FROM public.event_participants ep
        JOIN public.events ev ON ep.event_id = ev.id
        WHERE ep.is_volunteer = TRUE
          AND ep.volunteer_id IS NOT NULL
          -- Only insert if no matching submission exists
          AND NOT EXISTS (
              SELECT 1 FROM public.activity_submissions asub
              WHERE asub.volunteer_id = ep.volunteer_id
                AND asub.activity_type_id = v_event_activity_type_id
                AND asub.description LIKE '%' || ev.name || '%'
          );
        
        GET DIAGNOSTICS backfill_count = ROW_COUNT;
        RAISE NOTICE 'Backfilled % missing event participations', backfill_count;
    END IF;
END $$;

-- =============================================
-- PART 4: Update total_points for all affected volunteers
-- Recalculate total_points based on approved submissions
-- =============================================

UPDATE public.profiles p
SET total_points = COALESCE(sub_totals.total, 0)
FROM (
    SELECT 
        volunteer_id,
        SUM(points_awarded) as total
    FROM public.activity_submissions
    WHERE status = 'approved'
    GROUP BY volunteer_id
) sub_totals
WHERE p.id = sub_totals.volunteer_id
  AND p.total_points != COALESCE(sub_totals.total, 0);
