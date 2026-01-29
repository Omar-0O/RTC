-- Add cover_url to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_url TEXT;
