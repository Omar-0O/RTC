-- ============================================================================
-- Migration: Remove organizers automatically when course is completed
-- ============================================================================

-- Create trigger function to automatically remove organizers when a course is completed
CREATE OR REPLACE FUNCTION public.check_course_finished_and_remove_organizers()
RETURNS TRIGGER AS $$
DECLARE
    v_total_lectures INT;
    v_completed_or_cancelled_count INT;
    v_should_remove BOOLEAN := FALSE;
BEGIN
    -- Case 1: Triggered by courses table update (certificate_status changed from pending to finished)
    IF TG_TABLE_NAME = 'courses' THEN
        IF NEW.certificate_status IS DISTINCT FROM OLD.certificate_status 
           AND NEW.certificate_status IS NOT NULL 
           AND NEW.certificate_status <> 'pending' THEN
            v_should_remove := TRUE;
        END IF;
        
    -- Case 2: Triggered by course_lectures table update or insert
    ELSIF TG_TABLE_NAME = 'course_lectures' THEN
        -- Only check if status changed to completed or cancelled
        IF (TG_OP = 'INSERT' AND NEW.status IN ('completed', 'cancelled')) OR
           (TG_OP = 'UPDATE' AND NEW.status IN ('completed', 'cancelled') AND NEW.status IS DISTINCT FROM OLD.status) THEN
            
            -- Get total lectures
            SELECT total_lectures INTO v_total_lectures
            FROM public.courses
            WHERE id = NEW.course_id;

            IF FOUND THEN
                -- Count completed and cancelled lectures
                SELECT COUNT(*) INTO v_completed_or_cancelled_count
                FROM public.course_lectures
                WHERE course_id = NEW.course_id
                  AND status IN ('completed', 'cancelled');

                -- If all lectures are done (completed or cancelled)
                IF v_completed_or_cancelled_count >= v_total_lectures THEN
                    v_should_remove := TRUE;
                END IF;
            END IF;
        END IF;
    END IF;

    -- If the course is finished, remove the organizers
    IF v_should_remove THEN
        DELETE FROM public.course_organizers
        WHERE course_id = COALESCE(NEW.id, NEW.course_id);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for course_lectures
DROP TRIGGER IF EXISTS trigger_remove_organizers_on_lecture_completion ON public.course_lectures;
CREATE TRIGGER trigger_remove_organizers_on_lecture_completion
AFTER INSERT OR UPDATE ON public.course_lectures
FOR EACH ROW
EXECUTE FUNCTION public.check_course_finished_and_remove_organizers();

-- Trigger for courses
DROP TRIGGER IF EXISTS trigger_remove_organizers_on_status_change ON public.courses;
CREATE TRIGGER trigger_remove_organizers_on_status_change
AFTER UPDATE ON public.courses
FOR EACH ROW
EXECUTE FUNCTION public.check_course_finished_and_remove_organizers();
