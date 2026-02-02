-- Create 'General' committee if it doesn't exist
DO $$
DECLARE
    general_committee_id uuid;
BEGIN
    -- Check if 'General' committee exists (checking both English and Arabic names just in case)
    SELECT id INTO general_committee_id FROM committees WHERE name = 'General' OR name_ar = 'عام' LIMIT 1;

    -- If not, create it
    IF general_committee_id IS NULL THEN
        INSERT INTO committees (name, name_ar, description, description_ar, color, committee_type)
        VALUES ('General', 'عام', 'General activities not tied to a specific committee', 'أنشطة عامة غير تابعة للجنة محددة', '#808080', 'general')
        RETURNING id INTO general_committee_id;
        
        RAISE NOTICE 'Created General committee with ID: %', general_committee_id;
    ELSE
        RAISE NOTICE 'General committee already exists with ID: %', general_committee_id;
    END IF;

    -- Update activity_submissions with NULL committee_id
    UPDATE activity_submissions
    SET committee_id = general_committee_id
    WHERE committee_id IS NULL;
    
    -- Update group_submissions with NULL committee_id
    UPDATE group_submissions
    SET committee_id = general_committee_id
    WHERE committee_id IS NULL;
    
    -- Link "General" activity types (those with no committee) to this new committee
    -- first find activity types that have NO entries in activity_type_committees (if that's how it's modelled)
    -- OR check existing logic. 
    -- The existing code in LogActivity.tsx implies: `a.committee_ids.length === 0`
    -- So we should insert into activity_type_committees for these activities.
    
    INSERT INTO activity_type_committees (activity_type_id, committee_id)
    SELECT id, general_committee_id
    FROM activity_types
    WHERE id NOT IN (SELECT activity_type_id FROM activity_type_committees);
    
END $$;
