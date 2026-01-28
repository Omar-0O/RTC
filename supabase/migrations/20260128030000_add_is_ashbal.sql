-- Add is_ashbal column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN is_ashbal boolean DEFAULT false;

-- Comment on column
COMMENT ON COLUMN public.profiles.is_ashbal IS 'Flag to identify Ashbal (Cub Scouts) members';
