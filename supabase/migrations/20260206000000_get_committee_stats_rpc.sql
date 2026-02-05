CREATE OR REPLACE FUNCTION get_committees_with_stats(
    p_start_date text DEFAULT NULL,
    p_end_date text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    name text,
    name_ar text,
    description text,
    description_ar text,
    color text,
    committee_type text,
    volunteer_count bigint,
    trainer_count bigint,
    total_points bigint,
    participation_count bigint
) AS $$
BEGIN
    RETURN QUERY
    WITH vol_counts AS (
        SELECT p.committee_id, COUNT(*) as count
        FROM profiles p
        WHERE p.committee_id IS NOT NULL
        GROUP BY p.committee_id
    ),
    trainer_counts AS (
        SELECT t.committee_id, COUNT(*) as count
        FROM trainers t
        WHERE t.committee_id IS NOT NULL
        GROUP BY t.committee_id
    ),
    activity_stats AS (
        SELECT
            sub.committee_id,
            COUNT(*) as p_count,
            COALESCE(SUM(sub.points_awarded), 0) as points_sum
        FROM activity_submissions sub
        WHERE sub.committee_id IS NOT NULL
          AND sub.status = 'approved'
          AND (p_start_date IS NULL OR sub.submitted_at >= p_start_date::timestamptz)
          AND (p_end_date IS NULL OR sub.submitted_at <= p_end_date::timestamptz)
        GROUP BY sub.committee_id
    )
    SELECT
        c.id,
        c.name,
        c.name_ar,
        c.description,
        c.description_ar,
        c.color,
        c.committee_type,
        COALESCE(vc.count, 0) as volunteer_count,
        COALESCE(tc.count, 0) as trainer_count,
        COALESCE(as_stats.points_sum, 0)::bigint as total_points,
        COALESCE(as_stats.p_count, 0) as participation_count
    FROM committees c
    LEFT JOIN vol_counts vc ON c.id = vc.committee_id
    LEFT JOIN trainer_counts tc ON c.id = tc.committee_id
    LEFT JOIN activity_stats as_stats ON c.id = as_stats.committee_id
    ORDER BY c.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
