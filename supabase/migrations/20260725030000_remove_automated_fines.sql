-- Remove automated vest fines from volunteer_fines_view
-- volunteer_fines_view will now ONLY show manual fines created in public.volunteer_fines

-- 1. Reset wore_vest flag to true for all past activity/caravan/event/ethics_call records
UPDATE public.activity_submissions SET wore_vest = true WHERE wore_vest = false;
UPDATE public.caravan_participants SET wore_vest = true WHERE wore_vest = false;
UPDATE public.event_participants SET wore_vest = true WHERE wore_vest = false;
UPDATE public.ethics_calls_participants SET wore_vest = true WHERE wore_vest = false;

-- 2. Delete any automatic vest fines if any were recorded in volunteer_fines
DELETE FROM public.volunteer_fines
WHERE description ILIKE '%vest%'
   OR description ILIKE '%فيست%'
   OR description ILIKE '%سترة%';

-- 3. Recreate volunteer_fines_view to ONLY show manual fines from public.volunteer_fines
DROP VIEW IF EXISTS public.volunteer_fines_view;

CREATE OR REPLACE VIEW public.volunteer_fines_view AS
SELECT
    vf.volunteer_id,
    'manual'::text as source_type,
    vf.id as source_id,
    ft.name as source_name,
    ft.name_ar as source_name_ar,
    vf.created_at as created_at,
    vf.amount as amount,
    COALESCE(vf.is_paid, false) as is_paid,
    p.full_name as reviewed_by_name,
    p.full_name_ar as reviewed_by_name_ar,
    vf.branch_id
FROM public.volunteer_fines vf
JOIN public.fine_types ft ON vf.fine_type_id = ft.id
LEFT JOIN public.profiles p ON vf.created_by = p.id;

-- Grant permissions
GRANT SELECT ON public.volunteer_fines_view TO authenticated;
GRANT SELECT ON public.volunteer_fines_view TO service_role;

-- Update RLS policy on volunteer_fines so volunteers can view their own fines regardless of branch
DROP POLICY IF EXISTS "vfi_select" ON public.volunteer_fines;
CREATE POLICY "vfi_select" ON public.volunteer_fines FOR SELECT TO authenticated
  USING (volunteer_id = auth.uid() OR public.is_admin_or_exec() OR branch_id = public.get_my_branch_id());
