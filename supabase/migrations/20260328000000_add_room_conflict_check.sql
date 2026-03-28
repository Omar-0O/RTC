-- Function to check for room/lab booking conflicts before inserting or updating a course.
-- Returns rows if a conflict exists, empty if no conflict.
CREATE OR REPLACE FUNCTION public.check_room_conflict(
    p_room          TEXT,
    p_schedule_days TEXT[],
    p_schedule_time TIME,
    p_schedule_end_time TIME,
    p_start_date    DATE,
    p_end_date      DATE,
    p_exclude_course_id UUID DEFAULT NULL
)
RETURNS TABLE (
    conflicting_course_name       TEXT,
    conflicting_committee_name    TEXT,
    conflicting_committee_name_ar TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.name::TEXT                            AS conflicting_course_name,
        COALESCE(cm.name, '')::TEXT             AS conflicting_committee_name,
        COALESCE(cm.name_ar, '')::TEXT          AS conflicting_committee_name_ar
    FROM public.courses c
    LEFT JOIN public.committees cm ON cm.id = c.committee_id
    WHERE
        -- Same room
        c.room = p_room

        -- Exclude the course being edited (for updates)
        AND (p_exclude_course_id IS NULL OR c.id <> p_exclude_course_id)

        -- Overlapping date ranges:
        -- existing course starts before new course ends AND existing course ends after new course starts
        AND c.start_date <= COALESCE(p_end_date, '9999-12-31'::DATE)
        AND COALESCE(c.end_date, '9999-12-31'::DATE) >= p_start_date

        -- At least one schedule day in common
        AND c.schedule_days && p_schedule_days

        -- Overlapping time ranges:
        -- existing [schedule_time, schedule_end_time] overlaps new [p_schedule_time, p_schedule_end_time]
        AND c.schedule_time < COALESCE(p_schedule_end_time, p_schedule_time + INTERVAL '1 hour')
        AND COALESCE(c.schedule_end_time, c.schedule_time + INTERVAL '1 hour') > p_schedule_time

    LIMIT 1;
END;
$$;

-- Grant execute to authenticated users so the frontend can call it via RPC
GRANT EXECUTE ON FUNCTION public.check_room_conflict(TEXT, TEXT[], TIME, TIME, DATE, DATE, UUID)
    TO authenticated;
