-- Add specialization field to trainers table
ALTER TABLE public.trainers 
ADD COLUMN IF NOT EXISTS specialization TEXT;

COMMENT ON COLUMN public.trainers.specialization IS 'Trainer specialization - a brief description of what they teach';
