-- Fix the deduct_points_on_submission_delete function to correctly calculate level after deletion
-- The issue was using total_points (before deduction) in calculate_level instead of the new value

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
