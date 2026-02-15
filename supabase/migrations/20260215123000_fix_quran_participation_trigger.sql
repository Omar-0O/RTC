-- Final "Super-Fix" for Quran session participation trigger
-- 1. Drops all known legacy triggers to prevent duplicates/incorrect types.
-- 2. Correctly synchronizes quran_teachers with trainers.
-- 3. Populates ALL metadata columns (trainer_id, guest_name, guest_phone) to guarantee display.
-- 4. NEW: Adds source tracking (source_type/source_id) for automatic cleanup on delete.

-- 1. CLEANUP: Drop all potential legacy triggers and functions safely
DROP TRIGGER IF EXISTS on_session_created ON public.quran_circle_sessions;
DROP TRIGGER IF EXISTS on_session_deleted ON public.quran_circle_sessions;
DROP TRIGGER IF EXISTS trigger_log_quran_session_activity ON public.quran_circle_sessions;
DROP TRIGGER IF EXISTS on_quran_session_created ON public.quran_circle_sessions;
DROP FUNCTION IF EXISTS public.log_quran_session_activity() CASCADE;
DROP FUNCTION IF EXISTS public.delete_quran_session_activity() CASCADE;

-- 2. CREATE: Improved Trigger Function (INSERT)
CREATE OR REPLACE FUNCTION public.log_quran_session_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_quran_committee_id UUID;
    v_activity_type_id UUID;
    v_activity_points INTEGER;
    v_teacher_name TEXT;
    v_teacher_id UUID; 
    v_teacher_phone TEXT;
BEGIN
    -- Get Quran Committee ID
    SELECT id INTO v_quran_committee_id FROM public.committees 
    WHERE name_ar ILIKE '%أهل القرآن%' OR name_ar ILIKE '%اهل القران%' OR name ILIKE '%Ahl Al-Quran%'
    OR name ILIKE '%Quran%'
    ORDER BY CASE WHEN name_ar ILIKE '%أهل%' THEN 1 ELSE 2 END 
    LIMIT 1;

    -- Get Activity Type ID and points
    SELECT id, COALESCE(points, 5) INTO v_activity_type_id, v_activity_points 
    FROM public.activity_types 
    WHERE name = 'Quran Circle Session' OR name_ar = 'جلسة حلقة قرآن' OR name_ar = 'حلقة قرآن'
    OR name ILIKE '%Quran Circle%'
    ORDER BY CASE WHEN name = 'Quran Circle Session' THEN 1 ELSE 2 END
    LIMIT 1;
    
    -- Get Teacher Info from the circle
    SELECT c.teacher_id, t.name, t.phone INTO v_teacher_id, v_teacher_name, v_teacher_phone
    FROM public.quran_circles c
    LEFT JOIN public.quran_teachers t ON c.teacher_id = t.id
    WHERE c.id = NEW.circle_id;

    -- Proceed only if we have the necessary IDs
    IF v_teacher_id IS NOT NULL 
       AND v_quran_committee_id IS NOT NULL 
       AND v_activity_type_id IS NOT NULL THEN
        
        -- SYNC: Ensure the teacher exists in the public.trainers table (satisfies FK constraint)
        INSERT INTO public.trainers (id, name_en, name_ar, phone, updated_at)
        VALUES (v_teacher_id, v_teacher_name, v_teacher_name, COALESCE(v_teacher_phone, ''), NOW())
        ON CONFLICT (id) DO UPDATE SET 
            name_en = EXCLUDED.name_en, 
            name_ar = EXCLUDED.name_ar, 
            phone = EXCLUDED.phone,
            updated_at = NOW();

        -- INSERT SUBMISSION
        -- We populate ALL columns to be 100% sure it shows correctly in the UI
        INSERT INTO public.activity_submissions (
            trainer_id,         -- Primary link
            guest_name,         -- Backup for display if system treats NULL volunteer as guest
            guest_phone,        -- Backup for phone display
            participant_type,   -- Explicitly set to trainer
            committee_id,
            activity_type_id,
            description,
            points_awarded,
            status,
            submitted_at,
            source_type,        -- For cleanup
            source_id           -- For cleanup
        ) VALUES (
            v_teacher_id,
            v_teacher_name,     -- Copying name here too
            v_teacher_phone,    -- Copying phone here too
            'trainer',          -- CRITICAL: explicitly trainer
            v_quran_committee_id,
            v_activity_type_id,
            'جلسة حلقة: ' || COALESCE(v_teacher_name, 'محفظ'),
            v_activity_points,
            'approved',
            NEW.session_date,
            'quran_session',    -- Fixed label
            NEW.id              -- Current session ID
        );
        
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. CREATE: Deletion Function
CREATE OR REPLACE FUNCTION public.delete_quran_session_activity()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.activity_submissions
    WHERE source_type = 'quran_session'
      AND source_id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. APPLY: Create triggers
CREATE TRIGGER on_session_created
    AFTER INSERT ON public.quran_circle_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.log_quran_session_activity();

CREATE TRIGGER on_session_deleted
    BEFORE DELETE ON public.quran_circle_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.delete_quran_session_activity();