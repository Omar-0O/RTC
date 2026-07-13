-- PART 2: Data Migration
-- Run this script ONLY AFTER running Part 1 successfully.

-- The profiles table is created by the later baseline migration. The replay
-- migration applies this data update after that baseline exists.
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    UPDATE public.profiles SET level = 'under_follow_up' WHERE level::text IN ('bronze', 'newbie', 'silver', 'active');
    UPDATE public.profiles SET level = 'project_responsible' WHERE level::text = 'gold';
    UPDATE public.profiles SET level = 'responsible' WHERE level::text IN ('platinum', 'diamond');
    ALTER TABLE public.profiles ALTER COLUMN level SET DEFAULT 'under_follow_up';
  END IF;
END;
$$;
