-- PART 2: Data Migration
-- Run this script ONLY AFTER running Part 1 successfully.

-- Update profiles
-- We cast level to text to avoid "invalid input value for enum" error if we check for values that don't exist in the enum
UPDATE profiles SET level = 'under_follow_up' WHERE level::text IN ('bronze', 'newbie', 'silver', 'active');
UPDATE profiles SET level = 'project_responsible' WHERE level::text = 'gold';
UPDATE profiles SET level = 'responsible' WHERE level::text IN ('platinum', 'diamond');

-- Set default
ALTER TABLE profiles ALTER COLUMN level SET DEFAULT 'under_follow_up';
