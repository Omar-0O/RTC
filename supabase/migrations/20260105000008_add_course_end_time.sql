-- Add schedule_end_time column to courses table
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS schedule_end_time TIME;
