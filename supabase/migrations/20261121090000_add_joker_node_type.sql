-- ============================================================================
-- Migration: Allow 'joker' classification on Activity Structure nodes
-- Date: 2026-11-21
-- ============================================================================
-- Rollback:
--   UPDATE public.activity_structure_nodes SET node_type = 'volunteer' WHERE node_type = 'joker';
--   ALTER TABLE public.activity_structure_nodes DROP CONSTRAINT IF EXISTS activity_structure_node_type_chk;
--   ALTER TABLE public.activity_structure_nodes ADD CONSTRAINT activity_structure_node_type_chk
--     CHECK (node_type IN ('volunteer', 'section'));

ALTER TABLE public.activity_structure_nodes
  DROP CONSTRAINT IF EXISTS activity_structure_node_type_chk;

ALTER TABLE public.activity_structure_nodes
  ADD CONSTRAINT activity_structure_node_type_chk
  CHECK (node_type IN ('volunteer', 'section', 'joker')) NOT VALID;

ALTER TABLE public.activity_structure_nodes
  VALIDATE CONSTRAINT activity_structure_node_type_chk;
