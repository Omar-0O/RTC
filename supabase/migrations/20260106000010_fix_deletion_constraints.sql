-- Fix deletion constraints for proper cascade/nullify behavior

-- ============================================
-- 1. COMMITTEE DELETION: Set related records to NULL
-- ============================================

-- Drop existing constraints and recreate with ON DELETE SET NULL
ALTER TABLE public.profiles 
  DROP CONSTRAINT IF EXISTS profiles_committee_id_fkey;
  
ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_committee_id_fkey 
  FOREIGN KEY (committee_id) REFERENCES public.committees(id) ON DELETE SET NULL;

ALTER TABLE public.activity_types 
  DROP CONSTRAINT IF EXISTS activity_types_committee_id_fkey;
  
ALTER TABLE public.activity_types 
  ADD CONSTRAINT activity_types_committee_id_fkey 
  FOREIGN KEY (committee_id) REFERENCES public.committees(id) ON DELETE SET NULL;

ALTER TABLE public.courses 
  DROP CONSTRAINT IF EXISTS courses_committee_id_fkey;
  
ALTER TABLE public.courses 
  ADD CONSTRAINT courses_committee_id_fkey 
  FOREIGN KEY (committee_id) REFERENCES public.committees(id) ON DELETE SET NULL;

-- ============================================
-- 2. ACTIVITY TYPE DELETION: Cascade delete submissions
-- ============================================

-- First, create a trigger to deduct points BEFORE the submission is deleted
CREATE OR REPLACE FUNCTION public.deduct_points_on_submission_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Only deduct if the submission was approved
  IF OLD.status = 'approved' THEN
    UPDATE public.profiles
    SET 
      total_points = GREATEST(0, total_points - COALESCE(OLD.points_awarded, 0)),
      activities_count = GREATEST(0, activities_count - 1),
      level = public.calculate_level(GREATEST(0, total_points - COALESCE(OLD.points_awarded, 0)))
    WHERE id = OLD.volunteer_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
DROP TRIGGER IF EXISTS on_submission_deleted ON public.activity_submissions;
CREATE TRIGGER on_submission_deleted
  BEFORE DELETE ON public.activity_submissions
  FOR EACH ROW EXECUTE FUNCTION public.deduct_points_on_submission_delete();

-- Now update the foreign key to cascade delete
ALTER TABLE public.activity_submissions 
  DROP CONSTRAINT IF EXISTS activity_submissions_activity_type_id_fkey;
  
ALTER TABLE public.activity_submissions 
  ADD CONSTRAINT activity_submissions_activity_type_id_fkey 
  FOREIGN KEY (activity_type_id) REFERENCES public.activity_types(id) ON DELETE CASCADE;

-- ============================================
-- 3. VOLUNTEER/PROFILE DELETION: Already has ON DELETE CASCADE
-- ============================================
-- The activity_submissions.volunteer_id already references profiles(id) ON DELETE CASCADE
-- from the original migration. No changes needed.
