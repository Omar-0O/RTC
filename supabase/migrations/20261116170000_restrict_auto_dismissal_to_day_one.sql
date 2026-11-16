-- Restrict automatic monthly dismissal check to the 1st day of each month (Africa/Cairo).
-- When p_force = false, calling run_monthly_auto_dismissal on any day other than day 1 is a no-op.

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
  v_cairo_now TIMESTAMP := v_now AT TIME ZONE 'Africa/Cairo';
  v_cairo_day INTEGER := EXTRACT(DAY FROM v_cairo_now)::INTEGER;
  v_current_ym TEXT := to_char(v_cairo_now, 'YYYY-MM');
  v_curr_month_start TIMESTAMPTZ := date_trunc('month', v_cairo_now) AT TIME ZONE 'Africa/Cairo';
  v_prev_month_start TIMESTAMPTZ := (date_trunc('month', v_cairo_now) - interval '1 month') AT TIME ZONE 'Africa/Cairo';
  v_dismissed_count INTEGER := 0;
BEGIN
  -- Automatic dismissal check only runs on the 1st day of the month
  IF NOT p_force AND v_cairo_day <> 1 THEN
    RETURN jsonb_build_object(
      'skipped', true,
      'reason', 'not_first_of_month',
      'cairo_day', v_cairo_day,
      'year_month', v_current_ym
    );
  END IF;

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
