-- PART 1: Schema Changes and Enum Updates
-- Run this script FIRST.

-- This historical migration predates the checked-in baseline schema. Keep it
-- harmless for clean local resets; its intended changes are replayed after the
-- baseline in 20251229235000_replay_legacy_schema_updates.sql.
ALTER TABLE IF EXISTS public.activity_submissions
  ADD COLUMN IF NOT EXISTS location text DEFAULT 'branch' CHECK (location IN ('branch', 'home'));

-- Remove hours_spent column
ALTER TABLE IF EXISTS public.activity_submissions DROP COLUMN IF EXISTS hours_spent;

-- Add new values to the enum
-- These must be committed before they can be used in data updates
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'volunteer_level') THEN
    ALTER TYPE public.volunteer_level ADD VALUE IF NOT EXISTS 'under_follow_up';
    ALTER TYPE public.volunteer_level ADD VALUE IF NOT EXISTS 'project_responsible';
    ALTER TYPE public.volunteer_level ADD VALUE IF NOT EXISTS 'responsible';
  END IF;
END;
$$;
