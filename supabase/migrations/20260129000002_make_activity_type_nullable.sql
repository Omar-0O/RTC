-- Make activity_type_id nullable to support fines (which don't have an activity type)
ALTER TABLE public.activity_submissions ALTER COLUMN activity_type_id DROP NOT NULL;
