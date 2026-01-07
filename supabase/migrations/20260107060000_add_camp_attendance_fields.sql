-- Add fields to track Mini Camp and Camp attendance
ALTER TABLE public.profiles
ADD COLUMN attended_mini_camp BOOLEAN DEFAULT FALSE,
ADD COLUMN attended_camp BOOLEAN DEFAULT FALSE;
