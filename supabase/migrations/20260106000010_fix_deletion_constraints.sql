-- Fix deletion constraints for proper cascade/nullify behavior
-- This migration ensures NO foreign key constraint errors occur when deleting

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

ALTER TABLE public.group_submissions
  DROP CONSTRAINT IF EXISTS group_submissions_committee_id_fkey;

ALTER TABLE public.group_submissions
  ADD CONSTRAINT group_submissions_committee_id_fkey
  FOREIGN KEY (committee_id) REFERENCES public.committees(id) ON DELETE SET NULL;

ALTER TABLE public.activity_submissions
  DROP CONSTRAINT IF EXISTS activity_submissions_committee_id_fkey;

ALTER TABLE public.activity_submissions
  ADD CONSTRAINT activity_submissions_committee_id_fkey
  FOREIGN KEY (committee_id) REFERENCES public.committees(id) ON DELETE SET NULL;

-- ============================================
-- 2. ACTIVITY TYPE DELETION: Cascade delete submissions
-- ============================================

-- First, create a trigger to deduct points BEFORE the submission is deleted
CREATE OR REPLACE FUNCTION public.deduct_points_on_submission_delete()
RETURNS TRIGGER AS $$
DECLARE
  new_points_total integer;
BEGIN
  -- Only deduct if the submission was approved
  IF OLD.status = 'approved' THEN
    -- Get current points from profile
    SELECT total_points INTO new_points_total
    FROM public.profiles
    WHERE id = OLD.volunteer_id;
    
    -- Calculate new points after deduction
    new_points_total := GREATEST(0, new_points_total - COALESCE(OLD.points_awarded, 0));
    
    -- Update profile with new points and correct level
    UPDATE public.profiles
    SET 
      total_points = new_points_total,
      activities_count = GREATEST(0, activities_count - 1),
      level = public.calculate_level(new_points_total)
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

ALTER TABLE public.group_submissions
  DROP CONSTRAINT IF EXISTS group_submissions_activity_type_id_fkey;

ALTER TABLE public.group_submissions
  ADD CONSTRAINT group_submissions_activity_type_id_fkey
  FOREIGN KEY (activity_type_id) REFERENCES public.activity_types(id) ON DELETE CASCADE;

-- ============================================
-- 3. VOLUNTEER/PROFILE DELETION: Cascade delete all related records
-- ============================================

-- user_private_details (CRITICAL - this was causing the error)
ALTER TABLE public.user_private_details
  DROP CONSTRAINT IF EXISTS user_private_details_id_fkey;

ALTER TABLE public.user_private_details
  ADD CONSTRAINT user_private_details_id_fkey
  FOREIGN KEY (id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- course_beneficiaries.created_by
ALTER TABLE public.course_beneficiaries
  DROP CONSTRAINT IF EXISTS course_beneficiaries_created_by_fkey;

ALTER TABLE public.course_beneficiaries
  ADD CONSTRAINT course_beneficiaries_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- course_attendance.created_by
ALTER TABLE public.course_attendance
  DROP CONSTRAINT IF EXISTS course_attendance_created_by_fkey;

ALTER TABLE public.course_attendance
  ADD CONSTRAINT course_attendance_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- courses.created_by
ALTER TABLE public.courses
  DROP CONSTRAINT IF EXISTS courses_created_by_fkey;

ALTER TABLE public.courses
  ADD CONSTRAINT courses_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- caravans.created_by
ALTER TABLE public.caravans
  DROP CONSTRAINT IF EXISTS caravans_created_by_fkey;

ALTER TABLE public.caravans
  ADD CONSTRAINT caravans_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- caravan_participants.volunteer_id
ALTER TABLE public.caravan_participants
  DROP CONSTRAINT IF EXISTS caravan_participants_volunteer_id_fkey;

ALTER TABLE public.caravan_participants
  ADD CONSTRAINT caravan_participants_volunteer_id_fkey
  FOREIGN KEY (volunteer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- group_submissions.leader_id
ALTER TABLE public.group_submissions
  DROP CONSTRAINT IF EXISTS group_submissions_leader_id_fkey;

ALTER TABLE public.group_submissions
  ADD CONSTRAINT group_submissions_leader_id_fkey
  FOREIGN KEY (leader_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- activity_submissions.reviewed_by (set null since reviewer shouldn't delete submission)
ALTER TABLE public.activity_submissions
  DROP CONSTRAINT IF EXISTS activity_submissions_reviewed_by_fkey;

ALTER TABLE public.activity_submissions
  ADD CONSTRAINT activity_submissions_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- activity_submissions.group_submission_id
ALTER TABLE public.activity_submissions
  DROP CONSTRAINT IF EXISTS activity_submissions_group_submission_id_fkey;

ALTER TABLE public.activity_submissions
  ADD CONSTRAINT activity_submissions_group_submission_id_fkey
  FOREIGN KEY (group_submission_id) REFERENCES public.group_submissions(id) ON DELETE CASCADE;

