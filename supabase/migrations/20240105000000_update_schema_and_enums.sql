-- PART 1: Schema Changes and Enum Updates
-- Run this script FIRST.

-- Add location column to activity_submissions
ALTER TABLE activity_submissions ADD COLUMN IF NOT EXISTS location text DEFAULT 'branch' CHECK (location IN ('branch', 'home'));

-- Remove hours_spent column
ALTER TABLE activity_submissions DROP COLUMN IF EXISTS hours_spent;

-- Add new values to the enum
-- These must be committed before they can be used in data updates
ALTER TYPE volunteer_level ADD VALUE IF NOT EXISTS 'under_follow_up';
ALTER TYPE volunteer_level ADD VALUE IF NOT EXISTS 'project_responsible';
ALTER TYPE volunteer_level ADD VALUE IF NOT EXISTS 'responsible';
