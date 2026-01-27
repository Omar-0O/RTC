-- =========================================================
-- FIX: Cascade Delete for Trainer Submissions
-- =========================================================
-- Problem: Deleting a trainer does not delete their lecture submissions from activity_submissions.
-- Solution: Add a trigger on DELETE from 'trainers' to clean up 'activity_submissions'.

CREATE OR REPLACE FUNCTION public.cascade_delete_trainer_submissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Delete all submissions related to this trainer
    -- Matches where trainer_id = OLD.id
    DELETE FROM public.activity_submissions
    WHERE trainer_id = OLD.id;
    
    -- Also delete submissions where volunteer_id is the trainer's user_id 
    -- ONLY if it was a 'trainer' participation (to avoid deleting their volunteer work if they are also a volunteer)
    -- BUT typically if a trainer is deleted, their specialized trainer account is gone.
    -- The safer bet is just deleting by trainer_id which tracks the lectures.
       
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_trainer_deleted_cascade_submissions ON public.trainers;

CREATE TRIGGER on_trainer_deleted_cascade_submissions
    BEFORE DELETE ON public.trainers
    FOR EACH ROW
    EXECUTE FUNCTION public.cascade_delete_trainer_submissions();
