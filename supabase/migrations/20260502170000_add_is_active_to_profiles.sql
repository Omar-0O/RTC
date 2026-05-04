-- Add is_active column to profiles table.
-- When false, the volunteer will not appear in volunteer search results
-- (group participations, caravans, events, etc.), but their data is preserved.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Create an index for performance since we'll be filtering by this often
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles (is_active);
