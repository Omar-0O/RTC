-- =========================================================
-- FIX: Cascade Delete for Caravan Submissions
-- =========================================================
-- Problem: Deleting a caravan does not delete its associated activity_submissions.
-- Reason: There is technically no foreign key linking activity_submissions directly to caravans (only via logic/description).
-- Solution: Add a trigger on DELETE from 'caravans' to clean up 'activity_submissions'.

CREATE OR REPLACE FUNCTION public.cascade_delete_caravan_submissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Delete all submissions related to this caravan
    -- We match by description pattern since we don't have a direct FK column for entity_id yet
    DELETE FROM public.activity_submissions
    WHERE description = 'قافلة: ' || OLD.name
       OR description = 'ضيف في قافلة: ' || OLD.name
       OR description = 'Caravan: ' || OLD.name
       OR description = 'Guest in caravan: ' || OLD.name;
       
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_caravan_deleted_cascade_submissions ON public.caravans;

CREATE TRIGGER on_caravan_deleted_cascade_submissions
    BEFORE DELETE ON public.caravans
    FOR EACH ROW
    EXECUTE FUNCTION public.cascade_delete_caravan_submissions();
