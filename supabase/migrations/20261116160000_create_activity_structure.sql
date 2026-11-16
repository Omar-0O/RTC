-- ============================================================================
-- Migration: Activity Structure (هيكلة النشاط)
-- Date: 2026-11-16
--
-- Purpose:
--   Branch-scoped org chart of activity volunteers, their responsibilities, and
--   reporting lines ("who reports to whom").
--
-- Access model:
--   * READ   : any authenticated user of the same branch; admin/executive see all
--              (via SECURITY DEFINER RPC get_activity_structure + table RLS).
--   * WRITE  : admin (any branch); branch_admin / supervisor (head of branch)
--              only inside their own branch.
--
-- Safety:
--   * Purely additive (new table, functions, policies) — no existing object changed.
--   * Integrity enforced server-side: same-branch parent, same-branch volunteer,
--     no reporting cycles, children re-attached to grandparent on delete.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.get_activity_structure(uuid);
--   DROP TABLE IF EXISTS public.activity_structure_nodes CASCADE;
--   DROP FUNCTION IF EXISTS public.activity_structure_validate_node();
--   DROP FUNCTION IF EXISTS public.activity_structure_reattach_children();
--   DROP FUNCTION IF EXISTS public.can_manage_activity_structure(uuid);
-- ============================================================================

-- 1. Table -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_structure_nodes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id        uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  parent_id        uuid REFERENCES public.activity_structure_nodes(id) ON DELETE SET NULL,
  volunteer_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title            text NOT NULL,
  responsibilities text[] NOT NULL DEFAULT '{}',
  color            text NOT NULL DEFAULT 'primary',
  sort_order       integer NOT NULL DEFAULT 0,
  created_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_structure_title_len CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  CONSTRAINT activity_structure_no_self_parent CHECK (parent_id IS NULL OR parent_id <> id),
  CONSTRAINT activity_structure_resp_count CHECK (coalesce(array_length(responsibilities, 1), 0) <= 30),
  CONSTRAINT activity_structure_color CHECK (
    color IN ('primary', 'blue', 'green', 'amber', 'rose', 'violet', 'teal', 'slate')
  )
);

COMMENT ON TABLE public.activity_structure_nodes IS
  'هيكلة النشاط — branch-scoped org chart: positions, assigned volunteer, responsibilities, reporting line (parent_id).';

CREATE INDEX IF NOT EXISTS idx_activity_structure_branch
  ON public.activity_structure_nodes (branch_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_activity_structure_parent
  ON public.activity_structure_nodes (parent_id);
CREATE INDEX IF NOT EXISTS idx_activity_structure_volunteer
  ON public.activity_structure_nodes (volunteer_id);

-- 2. Permission helper ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_manage_activity_structure(_branch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = (SELECT auth.uid()) AND role::text = 'admin'
  )
  OR (
    _branch_id IS NOT NULL
    AND _branch_id = (SELECT branch_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role::text IN ('branch_admin', 'supervisor')
    )
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_activity_structure(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_activity_structure(uuid) TO authenticated;

-- 3. Integrity triggers --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activity_structure_validate_node()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_parent_branch    uuid;
  v_volunteer_branch uuid;
  v_cycle            boolean;
BEGIN
  NEW.title := btrim(NEW.title);
  NEW.responsibilities := ARRAY(
    SELECT btrim(r) FROM unnest(coalesce(NEW.responsibilities, '{}')) AS r
    WHERE btrim(r) <> ''
  );
  NEW.updated_at := now();

  IF TG_OP = 'UPDATE' AND NEW.branch_id IS DISTINCT FROM OLD.branch_id THEN
    RAISE EXCEPTION 'Cannot move a structure node to another branch' USING ERRCODE = '22023';
  END IF;

  IF NEW.parent_id IS NOT NULL THEN
    SELECT branch_id INTO v_parent_branch
    FROM public.activity_structure_nodes WHERE id = NEW.parent_id;

    IF v_parent_branch IS NULL OR v_parent_branch <> NEW.branch_id THEN
      RAISE EXCEPTION 'Parent node must belong to the same branch' USING ERRCODE = '22023';
    END IF;

    IF TG_OP = 'UPDATE' THEN
      WITH RECURSIVE ancestors AS (
        SELECT n.id, n.parent_id, 1 AS depth
        FROM public.activity_structure_nodes n WHERE n.id = NEW.parent_id
        UNION ALL
        SELECT n.id, n.parent_id, a.depth + 1
        FROM public.activity_structure_nodes n
        JOIN ancestors a ON n.id = a.parent_id
        WHERE a.depth < 500
      )
      SELECT EXISTS (SELECT 1 FROM ancestors WHERE id = NEW.id) INTO v_cycle;

      IF v_cycle THEN
        RAISE EXCEPTION 'Reporting cycle detected: a node cannot report to its own subordinate'
          USING ERRCODE = '22023';
      END IF;
    END IF;
  END IF;

  IF NEW.volunteer_id IS NOT NULL THEN
    SELECT branch_id INTO v_volunteer_branch
    FROM public.profiles WHERE id = NEW.volunteer_id;

    IF v_volunteer_branch IS NOT NULL AND v_volunteer_branch <> NEW.branch_id THEN
      RAISE EXCEPTION 'Volunteer must belong to the same branch' USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_structure_validate ON public.activity_structure_nodes;
CREATE TRIGGER trg_activity_structure_validate
  BEFORE INSERT OR UPDATE ON public.activity_structure_nodes
  FOR EACH ROW EXECUTE FUNCTION public.activity_structure_validate_node();

-- When a position is removed, its subordinates report to the removed node's manager.
CREATE OR REPLACE FUNCTION public.activity_structure_reattach_children()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Skip during branch cascade deletes (branch row is already gone): every node
  -- of the branch is being removed, and re-parenting would conflict with that.
  IF EXISTS (SELECT 1 FROM public.branches WHERE id = OLD.branch_id) THEN
    UPDATE public.activity_structure_nodes
       SET parent_id = OLD.parent_id
     WHERE parent_id = OLD.id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_structure_reattach ON public.activity_structure_nodes;
CREATE TRIGGER trg_activity_structure_reattach
  BEFORE DELETE ON public.activity_structure_nodes
  FOR EACH ROW EXECUTE FUNCTION public.activity_structure_reattach_children();

REVOKE ALL ON FUNCTION public.activity_structure_validate_node() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activity_structure_reattach_children() FROM PUBLIC;

-- 4. RLS -----------------------------------------------------------------------
ALTER TABLE public.activity_structure_nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_structure_select" ON public.activity_structure_nodes;
CREATE POLICY "activity_structure_select" ON public.activity_structure_nodes
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin_or_exec())
    OR branch_id = (SELECT public.get_my_branch_id())
  );

DROP POLICY IF EXISTS "activity_structure_insert" ON public.activity_structure_nodes;
CREATE POLICY "activity_structure_insert" ON public.activity_structure_nodes
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_activity_structure(branch_id));

DROP POLICY IF EXISTS "activity_structure_update" ON public.activity_structure_nodes;
CREATE POLICY "activity_structure_update" ON public.activity_structure_nodes
  FOR UPDATE TO authenticated
  USING (public.can_manage_activity_structure(branch_id))
  WITH CHECK (public.can_manage_activity_structure(branch_id));

DROP POLICY IF EXISTS "activity_structure_delete" ON public.activity_structure_nodes;
CREATE POLICY "activity_structure_delete" ON public.activity_structure_nodes
  FOR DELETE TO authenticated
  USING (public.can_manage_activity_structure(branch_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_structure_nodes TO authenticated;
REVOKE ALL ON public.activity_structure_nodes FROM anon;

-- 5. Read RPC (exposes only the minimal volunteer card fields) -----------------
CREATE OR REPLACE FUNCTION public.get_activity_structure(_branch_id uuid)
RETURNS TABLE (
  id                 uuid,
  branch_id          uuid,
  parent_id          uuid,
  volunteer_id       uuid,
  title              text,
  responsibilities   text[],
  color              text,
  sort_order         integer,
  volunteer_name     text,
  volunteer_name_ar  text,
  volunteer_avatar   text,
  committee_name     text,
  committee_name_ar  text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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

  RETURN QUERY
  SELECT n.id, n.branch_id, n.parent_id, n.volunteer_id, n.title, n.responsibilities,
         n.color, n.sort_order,
         p.full_name, p.full_name_ar, p.avatar_url,
         c.name, c.name_ar
  FROM public.activity_structure_nodes n
  LEFT JOIN public.profiles p   ON p.id = n.volunteer_id
  LEFT JOIN public.committees c ON c.id = p.committee_id
  WHERE n.branch_id = _branch_id
  ORDER BY n.sort_order, n.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.get_activity_structure(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_activity_structure(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
