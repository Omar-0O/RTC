-- Replaces legacy Quran-circle policies that allowed cross-branch reads/writes.
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'quran_circles', 'quran_circle_organizers', 'quran_circle_marketers',
        'quran_circle_ads', 'quran_circle_sessions', 'quran_circle_beneficiaries',
        'quran_enrollments', 'quran_beneficiaries'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_record.policyname, policy_record.tablename);
  END LOOP;
END $$;

ALTER TABLE public.quran_circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quran_circle_organizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quran_circle_marketers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quran_circle_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quran_circle_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quran_circle_beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quran_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quran_beneficiaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY quran_circles_select ON public.quran_circles FOR SELECT TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());
CREATE POLICY quran_circles_manage ON public.quran_circles FOR ALL TO authenticated
  USING (public.is_admin_or_exec() OR (branch_id = public.get_my_branch_id() AND public.has_role(auth.uid(), 'head_quran')))
  WITH CHECK (public.is_admin_or_exec() OR (branch_id = public.get_my_branch_id() AND public.has_role(auth.uid(), 'head_quran')));

CREATE POLICY quran_beneficiaries_select ON public.quran_beneficiaries FOR SELECT TO authenticated
  USING (public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());
CREATE POLICY quran_beneficiaries_manage ON public.quran_beneficiaries FOR ALL TO authenticated
  USING (public.is_admin_or_exec() OR (branch_id = public.get_my_branch_id() AND public.has_role(auth.uid(), 'head_quran')))
  WITH CHECK (public.is_admin_or_exec() OR (branch_id = public.get_my_branch_id() AND public.has_role(auth.uid(), 'head_quran')));

CREATE POLICY quran_circle_organizers_select ON public.quran_circle_organizers FOR SELECT TO authenticated
  USING (public.is_admin_or_exec() OR EXISTS (SELECT 1 FROM public.quran_circles c WHERE c.id = circle_id AND c.branch_id = public.get_my_branch_id()));
CREATE POLICY quran_circle_organizers_manage ON public.quran_circle_organizers FOR ALL TO authenticated
  USING (public.is_admin_or_exec() OR (public.has_role(auth.uid(), 'head_quran') AND EXISTS (SELECT 1 FROM public.quran_circles c WHERE c.id = circle_id AND c.branch_id = public.get_my_branch_id())))
  WITH CHECK (public.is_admin_or_exec() OR (public.has_role(auth.uid(), 'head_quran') AND EXISTS (SELECT 1 FROM public.quran_circles c WHERE c.id = circle_id AND c.branch_id = public.get_my_branch_id())));

CREATE POLICY quran_circle_marketers_select ON public.quran_circle_marketers FOR SELECT TO authenticated
  USING (public.is_admin_or_exec() OR EXISTS (SELECT 1 FROM public.quran_circles c WHERE c.id = circle_id AND c.branch_id = public.get_my_branch_id()));
CREATE POLICY quran_circle_marketers_manage ON public.quran_circle_marketers FOR ALL TO authenticated
  USING (public.is_admin_or_exec() OR (EXISTS (SELECT 1 FROM public.quran_circles c WHERE c.id = circle_id AND c.branch_id = public.get_my_branch_id()) AND (public.has_role(auth.uid(), 'head_quran') OR public.has_role(auth.uid(), 'head_marketing'))))
  WITH CHECK (public.is_admin_or_exec() OR (EXISTS (SELECT 1 FROM public.quran_circles c WHERE c.id = circle_id AND c.branch_id = public.get_my_branch_id()) AND (public.has_role(auth.uid(), 'head_quran') OR public.has_role(auth.uid(), 'head_marketing'))));

CREATE POLICY quran_circle_ads_select ON public.quran_circle_ads FOR SELECT TO authenticated
  USING (public.is_admin_or_exec() OR EXISTS (SELECT 1 FROM public.quran_circles c WHERE c.id = circle_id AND c.branch_id = public.get_my_branch_id()));
CREATE POLICY quran_circle_ads_manage ON public.quran_circle_ads FOR ALL TO authenticated
  USING (public.is_admin_or_exec() OR (EXISTS (SELECT 1 FROM public.quran_circles c WHERE c.id = circle_id AND c.branch_id = public.get_my_branch_id()) AND (public.has_role(auth.uid(), 'head_quran') OR public.has_role(auth.uid(), 'head_marketing'))))
  WITH CHECK (public.is_admin_or_exec() OR (EXISTS (SELECT 1 FROM public.quran_circles c WHERE c.id = circle_id AND c.branch_id = public.get_my_branch_id()) AND (public.has_role(auth.uid(), 'head_quran') OR public.has_role(auth.uid(), 'head_marketing'))));

CREATE POLICY quran_sessions_manage ON public.quran_circle_sessions FOR ALL TO authenticated
  USING (public.is_admin_or_exec() OR EXISTS (SELECT 1 FROM public.quran_circle_organizers o JOIN public.quran_circles c ON c.id = o.circle_id WHERE o.circle_id = circle_id AND o.volunteer_id = auth.uid() AND c.branch_id = public.get_my_branch_id()))
  WITH CHECK (public.is_admin_or_exec() OR EXISTS (SELECT 1 FROM public.quran_circle_organizers o JOIN public.quran_circles c ON c.id = o.circle_id WHERE o.circle_id = circle_id AND o.volunteer_id = auth.uid() AND c.branch_id = public.get_my_branch_id()));
CREATE POLICY quran_sessions_select ON public.quran_circle_sessions FOR SELECT TO authenticated
  USING (public.is_admin_or_exec() OR EXISTS (SELECT 1 FROM public.quran_circles c WHERE c.id = circle_id AND c.branch_id = public.get_my_branch_id()));

CREATE POLICY quran_attendance_select ON public.quran_circle_beneficiaries FOR SELECT TO authenticated
  USING (public.is_admin_or_exec() OR EXISTS (SELECT 1 FROM public.quran_circles c WHERE c.id = circle_id AND c.branch_id = public.get_my_branch_id()));
CREATE POLICY quran_attendance_manage ON public.quran_circle_beneficiaries FOR ALL TO authenticated
  USING (public.is_admin_or_exec() OR EXISTS (SELECT 1 FROM public.quran_circle_organizers o JOIN public.quran_circles c ON c.id = o.circle_id WHERE o.circle_id = circle_id AND o.volunteer_id = auth.uid() AND c.branch_id = public.get_my_branch_id()))
  WITH CHECK (public.is_admin_or_exec() OR EXISTS (SELECT 1 FROM public.quran_circle_organizers o JOIN public.quran_circles c ON c.id = o.circle_id WHERE o.circle_id = circle_id AND o.volunteer_id = auth.uid() AND c.branch_id = public.get_my_branch_id()));

CREATE POLICY quran_enrollments_select ON public.quran_enrollments FOR SELECT TO authenticated
  USING (public.is_admin_or_exec() OR EXISTS (SELECT 1 FROM public.quran_circles c WHERE c.id = circle_id AND c.branch_id = public.get_my_branch_id()));
CREATE POLICY quran_enrollments_manage ON public.quran_enrollments FOR ALL TO authenticated
  USING (public.is_admin_or_exec() OR EXISTS (SELECT 1 FROM public.quran_circle_organizers o JOIN public.quran_circles c ON c.id = o.circle_id WHERE o.circle_id = circle_id AND o.volunteer_id = auth.uid() AND c.branch_id = public.get_my_branch_id()))
  WITH CHECK (public.is_admin_or_exec() OR EXISTS (SELECT 1 FROM public.quran_circle_organizers o JOIN public.quran_circles c ON c.id = o.circle_id WHERE o.circle_id = circle_id AND o.volunteer_id = auth.uid() AND c.branch_id = public.get_my_branch_id()));
