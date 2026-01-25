-- RPC Function to safely award ethics points
-- Bypass RLS table policies by running as SECURITY DEFINER, but enforce strict Role checks.

CREATE OR REPLACE FUNCTION public.award_ethics_call_points(participants jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_role public.app_role;
    v_result jsonb;
BEGIN
    -- 1. Check Permissions
    -- Allow: admin, supervisor, head_ethics (and other relevant heads just in case)
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'supervisor', 'head_ethics', 'head_production', 'head_fourth_year')
    ) THEN
        RAISE EXCEPTION 'Access Denied: You do not have permission to award ethics points.';
    END IF;

    -- 2. Insert Data
    -- We use jsonb_populate_recordset to convert the JSON array into rows matching activity_submissions structure
    WITH inserted AS (
        INSERT INTO public.activity_submissions (
            volunteer_id,
            activity_type_id,
            committee_id,
            description,
            status,
            points_awarded,
            submitted_at,
            created_at
        )
        SELECT 
            (x->>'volunteer_id')::uuid,
            (x->>'activity_type_id')::uuid,
            (x->>'committee_id')::uuid,
            x->>'description',
            (x->>'status')::public.submission_status,
            (x->>'points_awarded')::integer,
            COALESCE((x->>'submitted_at')::timestamptz, NOW()),
            NOW()
        FROM jsonb_array_elements(participants) AS x
        RETURNING *
    )
    SELECT jsonb_agg(to_jsonb(inserted.*)) INTO v_result FROM inserted;

    RETURN v_result;
END;
$$;
