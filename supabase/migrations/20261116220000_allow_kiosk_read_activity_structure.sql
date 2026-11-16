-- Allow kiosk service accounts to read activity structure board for the selected branch.

CREATE OR REPLACE FUNCTION public.get_activity_structure_board(_branch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nodes     jsonb;
  v_edges     jsonb;
  v_root_meta jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    public.is_admin_or_exec()
    OR _branch_id = public.get_my_branch_id()
    OR lower(COALESCE((SELECT auth.jwt() ->> 'email'), '')) IN ('medaniparticipations@rtc.org', 'kiosk@rtc.internal')
  ) THEN
    RAISE EXCEPTION 'Permission denied for this branch' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  INTO v_nodes
  FROM (
    SELECT n.id, n.branch_id, n.parent_id, n.volunteer_id, n.title, n.responsibilities,
           n.color, n.sort_order, n.node_type, n.section_id, n.board_owner_id,
           n.section_title, n.description, n.team_image_url,
           n.deputy_id, n.deputy_title,
           n.pos_x, n.pos_y, n.width, n.height,
           p.full_name AS volunteer_name,
           p.full_name_ar AS volunteer_name_ar,
           p.avatar_url AS volunteer_avatar,
           dp.full_name AS deputy_name,
           dp.full_name_ar AS deputy_name_ar,
           dp.avatar_url AS deputy_avatar,
           c.name AS committee_name,
           c.name_ar AS committee_name_ar
    FROM public.activity_structure_nodes n
    LEFT JOIN public.profiles p   ON p.id = n.volunteer_id
    LEFT JOIN public.profiles dp  ON dp.id = n.deputy_id
    LEFT JOIN public.committees c ON c.id = p.committee_id
    WHERE n.branch_id = _branch_id
    ORDER BY n.sort_order, n.created_at
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(e)::jsonb), '[]'::jsonb)
  INTO v_edges
  FROM (
    SELECT id, branch_id, source_id, target_id, label
    FROM public.activity_structure_edges
    WHERE branch_id = _branch_id
    ORDER BY created_at
  ) e;

  SELECT row_to_json(m)::jsonb
  INTO v_root_meta
  FROM (
    SELECT branch_id, title, description, team_image_url
    FROM public.activity_structure_root_meta
    WHERE branch_id = _branch_id
  ) m;

  RETURN jsonb_build_object(
    'nodes', v_nodes,
    'edges', v_edges,
    'root_meta', v_root_meta
  );
END;
$$;
