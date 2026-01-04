-- Function to automatically award badges when volunteer meets requirements

CREATE OR REPLACE FUNCTION public.auto_award_badges()
RETURNS TRIGGER AS $$
DECLARE
  badge_record RECORD;
BEGIN
  -- Loop through all auto-award badges
  FOR badge_record IN 
    SELECT id, points_required, activities_required 
    FROM public.badges 
    WHERE auto_award = true
  LOOP
    -- Check if volunteer meets the requirements
    IF (badge_record.points_required IS NULL OR NEW.total_points >= badge_record.points_required)
       AND (badge_record.activities_required IS NULL OR NEW.activities_count >= badge_record.activities_required)
    THEN
      -- Try to insert the badge (will fail silently if already exists due to unique constraint)
      INSERT INTO public.user_badges (user_id, badge_id)
      VALUES (NEW.id, badge_record.id)
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-award badges when profile is updated
DROP TRIGGER IF EXISTS trigger_auto_award_badges ON public.profiles;
CREATE TRIGGER trigger_auto_award_badges
  AFTER UPDATE OF total_points, activities_count ON public.profiles
  FOR EACH ROW
  WHEN (OLD.total_points IS DISTINCT FROM NEW.total_points OR OLD.activities_count IS DISTINCT FROM NEW.activities_count)
  EXECUTE FUNCTION public.auto_award_badges();
