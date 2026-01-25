-- Add user_id to trainers table
ALTER TABLE public.trainers 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.trainers.user_id IS 'Link to the auth.users table for this trainer';
