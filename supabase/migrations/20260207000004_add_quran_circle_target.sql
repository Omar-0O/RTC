-- Add target_group to quran_circles
ALTER TABLE public.quran_circles 
ADD COLUMN IF NOT EXISTS target_group TEXT CHECK (target_group IN ('men', 'children'));
