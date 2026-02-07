-- Update target_group values and constraint
ALTER TABLE public.quran_circles 
DROP CONSTRAINT IF EXISTS quran_circles_target_group_check;

UPDATE public.quran_circles 
SET target_group = 'adults' 
WHERE target_group = 'men';

ALTER TABLE public.quran_circles 
ADD CONSTRAINT quran_circles_target_group_check 
CHECK (target_group IN ('adults', 'children'));
