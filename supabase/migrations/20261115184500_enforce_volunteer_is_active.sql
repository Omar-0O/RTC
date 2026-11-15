-- Migration: Volunteer Dismissal ("الرفد") & Monthly Automatic Dismissal System
-- 1. Add auto_dismissal_enabled (default true), dismissal_reason, and dismissed_at to public.profiles
-- 2. Create monthly_auto_dismissal_runs tracking table and idempotent RPC public.run_monthly_auto_dismissal
-- 3. Schedule monthly automatic execution on the 1st of every month via pg_cron (when available)
-- 4. Exclude dismissed volunteers (is_active = false) from public.get_leaderboard
-- 5. Keep activity_submissions INSERT open for dismissed volunteers so they can still log participations

BEGIN;

-- 1. Add dismissal columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auto_dismissal_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS dismissal_reason TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_auto_dismissal
  ON public.profiles (is_active, auto_dismissal_enabled);

-- 2. Tracking table for monthly auto-dismissal runs (idempotent once per YYYY-MM)
CREATE TABLE IF NOT EXISTS public.monthly_auto_dismissal_runs (
  year_month TEXT PRIMARY KEY,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed_count INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.monthly_auto_dismissal_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "madr_select" ON public.monthly_auto_dismissal_runs;
CREATE POLICY "madr_select" ON public.monthly_auto_dismissal_runs
  FOR SELECT TO authenticated USING (true);

-- 3. Function to evaluate and dismiss volunteers at the start of each month
-- Criteria:
--   - Volunteer is currently active (is_active = true)
--   - auto_dismissal_enabled = true (default true, unless manually exempted by Admin / Head HR / Branch Head)
--   - Not an admin/executive and not the kiosk service account
--   - Joined before the start of the current month
--   - Did NOT achieve previous month's required participation target (4 for under_follow_up/active, 8 for project_responsible/responsible)
--     OR has an unpaid fine (volunteer_fines.is_paid = false)
CREATE OR REPLACE FUNCTION public.run_monthly_auto_dismissal(
  p_force BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_current_ym TEXT := to_char(v_now AT TIME ZONE 'Africa/Cairo', 'YYYY-MM');
  v_curr_month_start TIMESTAMPTZ := (date_trunc('month', v_now AT TIME ZONE 'Africa/Cairo')) AT TIME ZONE 'Africa/Cairo';
  v_prev_month_start TIMESTAMPTZ := (date_trunc('month', v_now AT TIME ZONE 'Africa/Cairo') - interval '1 month') AT TIME ZONE 'Africa/Cairo';
  v_dismissed_count INTEGER := 0;
BEGIN
  -- Idempotency check: only run once per calendar month unless p_force = true
  IF NOT p_force AND EXISTS (
    SELECT 1 FROM public.monthly_auto_dismissal_runs WHERE year_month = v_current_ym
  ) THEN
    RETURN jsonb_build_object(
      'already_ran', true,
      'year_month', v_current_ym
    );
  END IF;

  WITH volunteer_eval AS (
    SELECT
      p.id,
      CASE
        WHEN lower(COALESCE(p.level::text, '')) IN ('project_responsible', 'gold', 'responsible', 'platinum', 'diamond') THEN 8
        ELSE 4
      END AS required_target,
      COALESCE((
        SELECT COUNT(*)
        FROM public.activity_submissions s
        WHERE s.volunteer_id = p.id
          AND s.status = 'approved'
          AND s.submitted_at >= v_prev_month_start
          AND s.submitted_at < v_curr_month_start
      ), 0) AS approved_count,
      EXISTS (
        SELECT 1
        FROM public.volunteer_fines vf
        WHERE vf.volunteer_id = p.id
          AND COALESCE(vf.is_paid, false) = false
      ) AS has_unpaid_fine
    FROM public.profiles p
    WHERE p.is_active = true
      AND p.auto_dismissal_enabled = true
      AND lower(COALESCE(p.email, '')) NOT IN ('medaniparticipations@rtc.org', 'kiosk@rtc.internal')
      AND COALESCE(p.join_date::timestamptz, p.created_at) < v_curr_month_start
      AND NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = p.id
          AND ur.role::text IN ('admin', 'executive')
      )
  ),
  to_dismiss AS (
    SELECT
      ve.id,
      CASE
        WHEN ve.approved_count < ve.required_target AND ve.has_unpaid_fine THEN 'target_and_fine'
        WHEN ve.approved_count < ve.required_target THEN 'target_not_met'
        ELSE 'unpaid_fine'
      END AS reason
    FROM volunteer_eval ve
    WHERE ve.approved_count < ve.required_target
       OR ve.has_unpaid_fine = true
  ),
  updated AS (
    UPDATE public.profiles p
    SET
      is_active = false,
      dismissal_reason = td.reason,
      dismissed_at = v_now,
      updated_at = v_now
    FROM to_dismiss td
    WHERE p.id = td.id
    RETURNING p.id
  )
  SELECT COUNT(*) INTO v_dismissed_count FROM updated;

  INSERT INTO public.monthly_auto_dismissal_runs (year_month, executed_at, dismissed_count)
  VALUES (v_current_ym, v_now, v_dismissed_count)
  ON CONFLICT (year_month) DO UPDATE SET
    executed_at = EXCLUDED.executed_at,
    dismissed_count = EXCLUDED.dismissed_count;

  RETURN jsonb_build_object(
    'already_ran', false,
    'year_month', v_current_ym,
    'dismissed_count', v_dismissed_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_monthly_auto_dismissal(BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_monthly_auto_dismissal(BOOLEAN) TO service_role;

-- 4. Register pg_cron job if pg_cron extension is available (runs at 00:05 on the 1st of every month)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.schedule(
        'rtc-monthly-auto-dismissal',
        '5 0 1 * *',
        $cron$SELECT public.run_monthly_auto_dismissal(false);$cron$
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not schedule pg_cron job: %', SQLERRM;
    END;
  END IF;
END;
$$;

-- 5. Update get_leaderboard to exclude dismissed profiles (is_active = false)
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
  
  IF period_type = 'month' THEN
    start_date := date_trunc('month', target_date);
    end_date := date_trunc('month', target_date) + interval '1 month' - interval '1 second';
  ELSIF period_type = 'quarter' THEN
    start_date := date_trunc('quarter', target_date);
    end_date := date_trunc('quarter', target_date) + interval '3 months' - interval '1 second';
  ELSIF period_type = 'third_year' THEN
    IF current_month >= 9 THEN
      start_date := date_trunc('year', target_date) + interval '8 months';
      end_date := date_trunc('year', target_date) + interval '1 year' - interval '1 second';
    ELSIF current_month >= 5 THEN
      start_date := date_trunc('year', target_date) + interval '4 months';
      end_date := date_trunc('year', target_date) + interval '8 months' - interval '1 second';
    ELSE
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
    p.is_active = true
    AND (committee_filter IS NULL OR p.committee_id = committee_filter)
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

-- 6. Ensure activity_submissions INSERT policy allows dismissed volunteers to still log their participations
DROP POLICY IF EXISTS "as_insert" ON public.activity_submissions;
CREATE POLICY "as_insert" ON public.activity_submissions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());

-- 7. Allow committee leaders and committee heads (including head_marketing) to manage committee membership in their branch
CREATE OR REPLACE FUNCTION public.is_branch_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
      AND role::text IN (
        'branch_admin', 'head_hr', 'hr', 'supervisor',
        'committee_leader', 'head_marketing', 'head_quran',
        'head_production', 'head_fourth_year', 'head_events',
        'head_caravans', 'head_ethics', 'head_ashbal'
      )
  );
$$;

-- Remove legacy courses/quran_circles default features for head_marketing users
DELETE FROM public.user_features
WHERE feature IN ('courses_management', 'quran_circles_management')
  AND user_id IN (
    SELECT user_id FROM public.user_roles WHERE role::text = 'head_marketing'
  );

-- 8. Allow head_marketing to view activity proof images in storage
DROP POLICY IF EXISTS "activity_proofs_select" ON storage.objects;
CREATE POLICY "activity_proofs_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'activity-proofs'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role::text IN (
          'admin',
          'executive',
          'branch_admin',
          'supervisor',
          'hr',
          'head_hr',
          'committee_leader',
          'head_production',
          'head_fourth_year',
          'head_events',
          'head_caravans',
          'head_ethics',
          'head_quran',
          'head_ashbal',
          'head_marketing'
        )
    )
  )
);

-- 9. Clean up dead legacy Supabase storage URLs (dscphfuyhjorrshtyqan.supabase.co)
UPDATE public.profiles
SET avatar_url = NULL
WHERE avatar_url LIKE '%dscphfuyhjorrshtyqan.supabase.co%';

COMMIT;
