-- ============================================================================
-- Migration: Multi-Layer Drill-Down Boards & Root Branch Group Photo
-- Date: 2026-11-16
-- ============================================================================

-- 1. Add board_owner_id (NULL = root board; <node_id> = sub-board owned by that node)
--    and section_title (name of the section this volunteer leads)
ALTER TABLE public.activity_structure_nodes
  ADD COLUMN IF NOT EXISTS board_owner_id uuid REFERENCES public.activity_structure_nodes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS section_title  text;

CREATE INDEX IF NOT EXISTS idx_activity_structure_board_owner
  ON public.activity_structure_nodes (branch_id, board_owner_id);

-- 2. Root board metadata (branch group photo, title, description)
CREATE TABLE IF NOT EXISTS public.activity_structure_root_meta (
  branch_id      uuid PRIMARY KEY REFERENCES public.branches(id) ON DELETE CASCADE,
  title          text,
  description    text,
  team_image_url text,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_structure_root_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_structure_root_meta_select" ON public.activity_structure_root_meta
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin_or_exec())
    OR branch_id = (SELECT public.get_my_branch_id())
  );

CREATE POLICY "activity_structure_root_meta_insert" ON public.activity_structure_root_meta
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_activity_structure(branch_id));

CREATE POLICY "activity_structure_root_meta_update" ON public.activity_structure_root_meta
  FOR UPDATE TO authenticated
  USING (public.can_manage_activity_structure(branch_id))
  WITH CHECK (public.can_manage_activity_structure(branch_id));

GRANT SELECT, INSERT, UPDATE ON public.activity_structure_root_meta TO authenticated;
REVOKE ALL ON public.activity_structure_root_meta FROM anon;

-- 3. Update board RPC to include board_owner_id, section_title, and root_meta
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
  ) THEN
    RAISE EXCEPTION 'Permission denied for this branch' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  INTO v_nodes
  FROM (
    SELECT n.id, n.branch_id, n.parent_id, n.volunteer_id, n.title, n.responsibilities,
           n.color, n.sort_order, n.node_type, n.section_id, n.board_owner_id,
           n.section_title, n.description, n.team_image_url,
           n.pos_x, n.pos_y, n.width, n.height,
           p.full_name AS volunteer_name,
           p.full_name_ar AS volunteer_name_ar,
           p.avatar_url AS volunteer_avatar,
           c.name AS committee_name,
           c.name_ar AS committee_name_ar
    FROM public.activity_structure_nodes n
    LEFT JOIN public.profiles p   ON p.id = n.volunteer_id
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

NOTIFY pgrst, 'reload schema';
