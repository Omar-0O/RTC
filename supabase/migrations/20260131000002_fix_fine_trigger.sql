-- Fix: Exclude fines from activities_count and points calculation
-- The trigger should not add to activities_count when a fine is added

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_submission_approved ON public.activity_submissions;
DROP FUNCTION IF EXISTS public.update_user_points_on_approval();

-- Update the function to handle both INSERT and UPDATE, but exclude fines
CREATE OR REPLACE FUNCTION public.update_user_points_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip if this is a fine (has fine_type_id set)
  IF NEW.fine_type_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- On INSERT: if status is approved, add points
  IF (TG_OP = 'INSERT' AND NEW.status = 'approved') THEN
    UPDATE public.profiles
    SET 
      total_points = total_points + COALESCE(NEW.points_awarded, 0),
      activities_count = activities_count + 1,
      level = public.calculate_level(total_points + COALESCE(NEW.points_awarded, 0))
    WHERE id = NEW.volunteer_id;
  END IF;

  -- On UPDATE: if status changed from non-approved to approved, add points
  IF (TG_OP = 'UPDATE' AND NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved')) THEN
    UPDATE public.profiles
    SET 
      total_points = total_points + COALESCE(NEW.points_awarded, 0),
      activities_count = activities_count + 1,
      level = public.calculate_level(total_points + COALESCE(NEW.points_awarded, 0))
    WHERE id = NEW.volunteer_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for both INSERT and UPDATE
CREATE TRIGGER on_submission_approved
  AFTER INSERT OR UPDATE ON public.activity_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_user_points_on_approval();
