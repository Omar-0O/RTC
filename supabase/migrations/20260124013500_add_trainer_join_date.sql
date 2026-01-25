-- Add join_date column to trainers table
ALTER TABLE public.trainers ADD COLUMN IF NOT EXISTS join_date DATE DEFAULT CURRENT_DATE;

-- Backfill existing records with created_at date
UPDATE public.trainers SET join_date = created_at::date WHERE join_date IS NULL;

-- Make it not null after backfill
ALTER TABLE public.trainers ALTER COLUMN join_date SET NOT NULL;
