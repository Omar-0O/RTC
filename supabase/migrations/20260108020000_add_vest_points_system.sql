-- Add points_with_vest and points_without_vest columns to activity_types
-- This allows different point values based on whether the volunteer wore their vest

ALTER TABLE public.activity_types 
ADD COLUMN IF NOT EXISTS points_with_vest INTEGER,
ADD COLUMN IF NOT EXISTS points_without_vest INTEGER;

-- Migrate existing data: set both vest/no-vest points to current points value
UPDATE public.activity_types 
SET 
  points_with_vest = COALESCE(points_with_vest, points),
  points_without_vest = COALESCE(points_without_vest, points)
WHERE points_with_vest IS NULL OR points_without_vest IS NULL;

-- Update Caravan activity specifically (15 with vest, 5 without)
UPDATE public.activity_types 
SET 
  points_with_vest = 15,
  points_without_vest = 5
WHERE name ILIKE '%caravan%' OR name_ar LIKE '%قافلة%';

COMMENT ON COLUMN public.activity_types.points_with_vest IS 'Points awarded if volunteer wore vest during activity';
COMMENT ON COLUMN public.activity_types.points_without_vest IS 'Points awarded if volunteer did not wear vest during activity';
