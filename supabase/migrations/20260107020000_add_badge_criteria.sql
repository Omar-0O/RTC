-- Add new criteria columns to badges table
ALTER TABLE public.badges
ADD COLUMN IF NOT EXISTS months_required INTEGER,
ADD COLUMN IF NOT EXISTS caravans_required INTEGER;

COMMENT ON COLUMN public.badges.months_required IS 'Minimum number of months since joining required for auto-award';
COMMENT ON COLUMN public.badges.caravans_required IS 'Minimum number of completed caravan participations required for auto-award';

-- Update the auto-award function to include new criteria
CREATE OR REPLACE FUNCTION public.auto_award_badges()
RETURNS TRIGGER AS $$
DECLARE
  badge_record RECORD;
  user_caravans_count INTEGER;
  user_months_active INTEGER;
BEGIN
  -- extensive calculation might be heavy, so we calculate once per trigger execution
  
  -- Calculate months active
  -- Using 30 days as approximation for a month if precise calendar month isn't critical, 
  -- or use EXTRACT(year FROM age(...)) * 12 + EXTRACT(month FROM age(...))
  SELECT EXTRACT(year FROM age(now(), NEW.created_at)) * 12 + EXTRACT(month FROM age(now(), NEW.created_at))
  INTO user_months_active;

  -- Calculate caravan participations
  -- We assume caravans are activity_submissions with an activity_type that has name 'Caravan' or name_ar 'قافلة'
  -- OR strictly activity_types.name = 'Caravan'.
  -- Given previous research, we ensure creation of 'Caravan' activity type.
  SELECT COUNT(*)
  INTO user_caravans_count
  FROM public.activity_submissions as sub
  JOIN public.activity_types as type ON sub.activity_type_id = type.id
  WHERE sub.volunteer_id = NEW.id
  AND sub.status = 'approved'
  AND (type.name ILIKE '%Caravan%' OR type.name_ar ILIKE '%قافلة%');

  -- Loop through all auto-award badges
  FOR badge_record IN 
    SELECT id, points_required, activities_required, months_required, caravans_required
    FROM public.badges 
    WHERE auto_award = true
  LOOP
    -- Check if volunteer meets ALL requirements that are set (not null)
    IF (badge_record.points_required IS NULL OR NEW.total_points >= badge_record.points_required)
       AND (badge_record.activities_required IS NULL OR NEW.activities_count >= badge_record.activities_required)
       AND (badge_record.months_required IS NULL OR user_months_active >= badge_record.months_required)
       AND (badge_record.caravans_required IS NULL OR user_caravans_count >= badge_record.caravans_required)
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
