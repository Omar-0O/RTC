-- Add cover_url column to profiles table for storing cover image URL
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_url text;

-- Set a default random cover for existing users (optional)
-- UPDATE public.profiles SET cover_url = 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=1920&auto=format&fit=crop' WHERE cover_url IS NULL;
