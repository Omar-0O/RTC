-- Remove automatic volunteer level calculation from all triggers
-- The volunteer level should be manually managed, not automatically calculated based on points

-- ============================================
-- 1. Fix the deletion trigger (remove level auto-update)
-- ============================================
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
    
    -- Update profile with new points (DO NOT update level)
    UPDATE public.profiles
    SET 
      total_points = new_points_total,
      activities_count = GREATEST(0, activities_count - 1)
      -- Removed: level = public.calculate_level(new_points_total)
    WHERE id = OLD.volunteer_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- 2. Fix the approval/insert trigger (remove level auto-update)
-- ============================================
CREATE OR REPLACE FUNCTION public.update_points_on_submission()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update points if status is 'approved'
  IF NEW.status = 'approved' THEN
    -- For INSERT: Add points
    IF TG_OP = 'INSERT' THEN
      UPDATE public.profiles
      SET 
        total_points = total_points + COALESCE(NEW.points_awarded, 0),
        activities_count = activities_count + 1
        -- Removed: level = public.calculate_level(total_points + NEW.points_awarded)
      WHERE id = NEW.volunteer_id;
    
    -- For UPDATE: Adjust points if status changed to approved
    ELSIF TG_OP = 'UPDATE' AND OLD.status != 'approved' THEN
      UPDATE public.profiles
      SET 
        total_points = total_points + COALESCE(NEW.points_awarded, 0),
        activities_count = activities_count + 1
        -- Removed: level = public.calculate_level(total_points + NEW.points_awarded)
      WHERE id = NEW.volunteer_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
