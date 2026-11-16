-- ============================================================================
-- Migration: Upgrade Activity Structure to Free-Form Interactive Board & Sections
-- Date: 2026-11-16
-- ============================================================================

-- 1. Extend activity_structure_nodes for free canvas positioning & sections
ALTER TABLE public.activity_structure_nodes
  ADD COLUMN IF NOT EXISTS node_type      text NOT NULL DEFAULT 'volunteer',
  ADD COLUMN IF NOT EXISTS section_id     uuid REFERENCES public.activity_structure_nodes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description    text,
  ADD COLUMN IF NOT EXISTS team_image_url text,
  ADD COLUMN IF NOT EXISTS pos_x          double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pos_y          double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS width          integer NOT NULL DEFAULT 320,
  ADD COLUMN IF NOT EXISTS height         integer NOT NULL DEFAULT 220;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'activity_structure_node_type_chk'
  ) THEN
    ALTER TABLE public.activity_structure_nodes
      ADD CONSTRAINT activity_structure_node_type_chk CHECK (node_type IN ('volunteer', 'section'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_activity_structure_section
  ON public.activity_structure_nodes (section_id);

-- 2. Free-form connections table ("توصيلات") between any two nodes/sections
CREATE TABLE IF NOT EXISTS public.activity_structure_edges (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id  uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  source_id  uuid NOT NULL REFERENCES public.activity_structure_nodes(id) ON DELETE CASCADE,
  target_id  uuid NOT NULL REFERENCES public.activity_structure_nodes(id) ON DELETE CASCADE,
  label      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_structure_edges_no_self CHECK (source_id <> target_id),
  CONSTRAINT activity_structure_edges_unique UNIQUE (source_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_structure_edges_branch
  ON public.activity_structure_edges (branch_id);

ALTER TABLE public.activity_structure_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_structure_edges_select" ON public.activity_structure_edges
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin_or_exec())
    OR branch_id = (SELECT public.get_my_branch_id())
  );

CREATE POLICY "activity_structure_edges_insert" ON public.activity_structure_edges
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_activity_structure(branch_id));

CREATE POLICY "activity_structure_edges_update" ON public.activity_structure_edges
  FOR UPDATE TO authenticated
  USING (public.can_manage_activity_structure(branch_id))
  WITH CHECK (public.can_manage_activity_structure(branch_id));

CREATE POLICY "activity_structure_edges_delete" ON public.activity_structure_edges
  FOR DELETE TO authenticated
  USING (public.can_manage_activity_structure(branch_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_structure_edges TO authenticated;
REVOKE ALL ON public.activity_structure_edges FROM anon;

-- 3. Backfill any existing parent_id links into edges once
INSERT INTO public.activity_structure_edges (branch_id, source_id, target_id)
SELECT branch_id, parent_id, id
FROM public.activity_structure_nodes
WHERE parent_id IS NOT NULL
ON CONFLICT (source_id, target_id) DO NOTHING;

-- 4. RPC returning full board (nodes + edges) in one round-trip
CREATE OR REPLACE FUNCTION public.get_activity_structure_board(_branch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nodes jsonb;
  v_edges jsonb;
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
           n.color, n.sort_order, n.node_type, n.section_id, n.description,
           n.team_image_url, n.pos_x, n.pos_y, n.width, n.height,
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

  RETURN jsonb_build_object('nodes', v_nodes, 'edges', v_edges);
END;
$$;

REVOKE ALL ON FUNCTION public.get_activity_structure_board(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_activity_structure_board(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
