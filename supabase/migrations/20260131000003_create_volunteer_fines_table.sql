-- Create a separate table for manual fines
-- This separates fines from activity submissions completely

-- 1. Create the volunteer_fines table for manual fines
CREATE TABLE IF NOT EXISTS public.volunteer_fines (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    volunteer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    fine_type_id uuid NOT NULL REFERENCES public.fine_types(id) ON DELETE CASCADE,
    amount integer NOT NULL,
    description text,
    is_paid boolean DEFAULT false,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now(),
    paid_at timestamp with time zone
);

-- 2. Enable RLS
ALTER TABLE public.volunteer_fines ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies
-- Volunteers can view their own fines
CREATE POLICY "Users can view own fines" ON public.volunteer_fines
    FOR SELECT USING (volunteer_id = auth.uid());

-- HR/Admin can view all fines
CREATE POLICY "Privileged users can view all fines" ON public.volunteer_fines
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'head_hr', 'hr', 'supervisor')
        )
    );

-- HR/Admin can create fines
CREATE POLICY "Privileged users can create fines" ON public.volunteer_fines
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'head_hr', 'hr', 'supervisor')
        )
    );

-- HR/Admin can update fines (for marking as paid)
CREATE POLICY "Privileged users can update fines" ON public.volunteer_fines
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'head_hr', 'hr', 'supervisor')
        )
    );

-- 4. Migrate existing manual fines from activity_submissions to volunteer_fines
INSERT INTO public.volunteer_fines (volunteer_id, fine_type_id, amount, description, is_paid, created_by, created_at)
SELECT 
    s.volunteer_id,
    s.fine_type_id,
    ft.amount,
    s.description,
    COALESCE(s.is_paid, false),
    s.reviewed_by,
    s.submitted_at
FROM public.activity_submissions s
JOIN public.fine_types ft ON s.fine_type_id = ft.id
WHERE s.fine_type_id IS NOT NULL;

-- 5. Delete the migrated fines from activity_submissions
DELETE FROM public.activity_submissions WHERE fine_type_id IS NOT NULL;

-- 6. Drop and recreate the volunteer_fines_view to use the new table for manual fines
DROP VIEW IF EXISTS public.volunteer_fines_view;
CREATE VIEW public.volunteer_fines_view AS
-- 1. Activity Submissions (Automatic "No Vest" - positive points but wore_vest=false)
SELECT
    s.volunteer_id,
    'activity'::text as source_type,
    s.id as source_id,
    at.name as source_name,
    at.name_ar as source_name_ar,
    s.submitted_at as created_at,
    5 as amount,
    false as is_paid,
    NULL::text as reviewed_by_name,
    NULL::text as reviewed_by_name_ar
FROM activity_submissions s
JOIN activity_types at ON s.activity_type_id = at.id
WHERE s.wore_vest = false 
AND s.status = 'approved'
AND s.points_awarded >= 0 

UNION ALL

-- 2. Caravan Participants
SELECT
    cp.volunteer_id,
    'caravan'::text as source_type,
    cp.id as source_id,
    c.name as source_name,
    c.name as source_name_ar, 
    c.date::timestamp as created_at,
    5 as amount,
    false as is_paid,
    NULL::text as reviewed_by_name,
    NULL::text as reviewed_by_name_ar
FROM caravan_participants cp
JOIN caravans c ON cp.caravan_id = c.id
WHERE cp.wore_vest = false AND cp.volunteer_id IS NOT NULL

UNION ALL

-- 3. Event Participants
SELECT
    ep.volunteer_id,
    'event'::text as source_type,
    ep.id as source_id,
    e.name as source_name,
    e.name as source_name_ar,
    e.date::timestamp as created_at,
    5 as amount,
    false as is_paid,
    NULL::text as reviewed_by_name,
    NULL::text as reviewed_by_name_ar
FROM event_participants ep
JOIN events e ON ep.event_id = e.id
WHERE ep.wore_vest = false AND ep.volunteer_id IS NOT NULL

UNION ALL

-- 4. Ethics Call Participants
SELECT
    ecp.volunteer_id,
    'ethics_call'::text as source_type,
    ecp.id as source_id,
    ec.name as source_name,
    ec.name as source_name_ar,
    ec.date::timestamp as created_at,
    5 as amount,
    false as is_paid,
    NULL::text as reviewed_by_name,
    NULL::text as reviewed_by_name_ar
FROM ethics_calls_participants ecp
JOIN ethics_calls ec ON ecp.call_id = ec.id
WHERE ecp.wore_vest = false AND ecp.volunteer_id IS NOT NULL

UNION ALL

-- 5. Manual Fines (from the NEW volunteer_fines table)
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
    p.full_name_ar as reviewed_by_name_ar
FROM volunteer_fines vf
JOIN fine_types ft ON vf.fine_type_id = ft.id
LEFT JOIN profiles p ON vf.created_by = p.id;

-- Grant access
GRANT SELECT ON public.volunteer_fines_view TO authenticated;
GRANT SELECT ON public.volunteer_fines_view TO service_role;
GRANT ALL ON public.volunteer_fines TO authenticated;
GRANT ALL ON public.volunteer_fines TO service_role;
