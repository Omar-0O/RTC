-- Update the view to exclude manual fines (activity submissions with negative points)
-- from being counted as "No Vest" fines.

CREATE OR REPLACE VIEW public.volunteer_fines_view AS
-- 1. Activity Submissions
SELECT
    s.volunteer_id,
    'activity'::text as source_type,
    at.name as source_name,
    at.name_ar as source_name_ar,
    s.submitted_at as created_at,
    5 as amount
FROM activity_submissions s
JOIN activity_types at ON s.activity_type_id = at.id
WHERE s.wore_vest = false 
AND s.status = 'approved'
AND s.points_awarded >= 0 -- EXCLUDE manual fines

UNION ALL

-- 2. Caravan Participants
SELECT
    cp.volunteer_id,
    'caravan'::text as source_type,
    c.name as source_name,
    c.name as source_name_ar, 
    c.date::timestamp as created_at,
    5 as amount
FROM caravan_participants cp
JOIN caravans c ON cp.caravan_id = c.id
WHERE cp.wore_vest = false AND cp.volunteer_id IS NOT NULL

UNION ALL

-- 3. Event Participants
SELECT
    ep.volunteer_id,
    'event'::text as source_type,
    e.name as source_name,
    e.name as source_name_ar,
    e.date::timestamp as created_at,
    5 as amount
FROM event_participants ep
JOIN events e ON ep.event_id = e.id
WHERE ep.wore_vest = false AND ep.volunteer_id IS NOT NULL

UNION ALL

-- 4. Ethics Call Participants
SELECT
    ecp.volunteer_id,
    'ethics_call'::text as source_type,
    ec.name as source_name,
    ec.name as source_name_ar,
    ec.date::timestamp as created_at,
    5 as amount
FROM ethics_calls_participants ecp
JOIN ethics_calls ec ON ecp.call_id = ec.id
WHERE ecp.wore_vest = false AND ecp.volunteer_id IS NOT NULL;

-- Grant access
GRANT SELECT ON public.volunteer_fines_view TO authenticated;
GRANT SELECT ON public.volunteer_fines_view TO service_role;
