-- Fix: allow head_quran to manage enrollments, sessions, and attendance.
-- Previously these policies only allowed organizers of the specific circle,
-- which blocked head_quran users who aren't listed as an organizer.

-- ── quran_enrollments ──────────────────────────────────────────────
DROP POLICY IF EXISTS quran_enrollments_manage ON public.quran_enrollments;

CREATE POLICY quran_enrollments_manage ON public.quran_enrollments
  FOR ALL TO authenticated
  USING (
    public.is_admin_or_exec()
    OR (
      public.has_role(auth.uid(), 'head_quran')
      AND EXISTS (
        SELECT 1 FROM public.quran_circles c
        WHERE c.id = circle_id
          AND c.branch_id = public.get_my_branch_id()
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.quran_circle_organizers o
      JOIN public.quran_circles c ON c.id = o.circle_id
      WHERE o.circle_id = circle_id
        AND o.volunteer_id = auth.uid()
        AND c.branch_id = public.get_my_branch_id()
    )
  )
  WITH CHECK (
    public.is_admin_or_exec()
    OR (
      public.has_role(auth.uid(), 'head_quran')
      AND EXISTS (
        SELECT 1 FROM public.quran_circles c
        WHERE c.id = circle_id
          AND c.branch_id = public.get_my_branch_id()
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.quran_circle_organizers o
      JOIN public.quran_circles c ON c.id = o.circle_id
      WHERE o.circle_id = circle_id
        AND o.volunteer_id = auth.uid()
        AND c.branch_id = public.get_my_branch_id()
    )
  );

-- ── quran_circle_sessions ──────────────────────────────────────────
DROP POLICY IF EXISTS quran_sessions_manage ON public.quran_circle_sessions;

CREATE POLICY quran_sessions_manage ON public.quran_circle_sessions
  FOR ALL TO authenticated
  USING (
    public.is_admin_or_exec()
    OR (
      public.has_role(auth.uid(), 'head_quran')
      AND EXISTS (
        SELECT 1 FROM public.quran_circles c
        WHERE c.id = circle_id
          AND c.branch_id = public.get_my_branch_id()
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.quran_circle_organizers o
      JOIN public.quran_circles c ON c.id = o.circle_id
      WHERE o.circle_id = circle_id
        AND o.volunteer_id = auth.uid()
        AND c.branch_id = public.get_my_branch_id()
    )
  )
  WITH CHECK (
    public.is_admin_or_exec()
    OR (
      public.has_role(auth.uid(), 'head_quran')
      AND EXISTS (
        SELECT 1 FROM public.quran_circles c
        WHERE c.id = circle_id
          AND c.branch_id = public.get_my_branch_id()
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.quran_circle_organizers o
      JOIN public.quran_circles c ON c.id = o.circle_id
      WHERE o.circle_id = circle_id
        AND o.volunteer_id = auth.uid()
        AND c.branch_id = public.get_my_branch_id()
    )
  );

-- ── quran_circle_beneficiaries (attendance) ────────────────────────
DROP POLICY IF EXISTS quran_attendance_manage ON public.quran_circle_beneficiaries;

CREATE POLICY quran_attendance_manage ON public.quran_circle_beneficiaries
  FOR ALL TO authenticated
  USING (
    public.is_admin_or_exec()
    OR (
      public.has_role(auth.uid(), 'head_quran')
      AND EXISTS (
        SELECT 1 FROM public.quran_circles c
        WHERE c.id = circle_id
          AND c.branch_id = public.get_my_branch_id()
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.quran_circle_organizers o
      JOIN public.quran_circles c ON c.id = o.circle_id
      WHERE o.circle_id = circle_id
        AND o.volunteer_id = auth.uid()
        AND c.branch_id = public.get_my_branch_id()
    )
  )
  WITH CHECK (
    public.is_admin_or_exec()
    OR (
      public.has_role(auth.uid(), 'head_quran')
      AND EXISTS (
        SELECT 1 FROM public.quran_circles c
        WHERE c.id = circle_id
          AND c.branch_id = public.get_my_branch_id()
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.quran_circle_organizers o
      JOIN public.quran_circles c ON c.id = o.circle_id
      WHERE o.circle_id = circle_id
        AND o.volunteer_id = auth.uid()
        AND c.branch_id = public.get_my_branch_id()
    )
  );
