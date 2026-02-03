-- Add birth_date column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS birth_date DATE;
