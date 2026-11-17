-- ============================================================================
-- Migration: Promote embedded deputies into independent StructureNode rows
-- so that both Head and Deputy can have their own links and sections.
-- Date: 2026-11-16
-- ============================================================================

INSERT INTO public.activity_structure_nodes (
  branch_id,
  parent_id,
  volunteer_id,
  title,
  responsibilities,
  color,
  sort_order,
  node_type,
  board_owner_id,
  pos_x,
  pos_y,
  width,
  height
)
SELECT
  n.branch_id,
  NULL,
  n.deputy_id,
  COALESCE(NULLIF(trim(n.deputy_title), ''), 'نائب'),
  '{}'::text[],
  n.color,
  n.sort_order + 1,
  'volunteer',
  n.board_owner_id,
  n.pos_x - 180,
  n.pos_y + 8,
  n.width,
  n.height
FROM public.activity_structure_nodes n
WHERE n.deputy_id IS NOT NULL;

UPDATE public.activity_structure_nodes
SET deputy_id = NULL,
    deputy_title = NULL
WHERE deputy_id IS NOT NULL;
