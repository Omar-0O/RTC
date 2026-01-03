-- Update the Calculate Level function with new thresholds
-- Level 1 (0-50): Bronze ("Mubadir")
-- Level 2 (51-150): Silver ("Musahim")
-- Level 3 (151-350): Gold ("Moather")
-- Level 4 (351+): Platinum ("Qaed Molhem")

CREATE OR REPLACE FUNCTION public.calculate_level(points INTEGER)
RETURNS public.volunteer_level AS $$
BEGIN
  IF points > 350 THEN RETURN 'platinum';
  ELSIF points > 150 THEN RETURN 'gold';
  ELSIF points > 50 THEN RETURN 'silver';
  ELSE RETURN 'bronze';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- Trigger a re-calculation for all profiles to apply new levels immediately
UPDATE public.profiles
SET level = public.calculate_level(total_points);
