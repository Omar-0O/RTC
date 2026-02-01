-- Fix: Change quran_circles.teacher_id foreign key from quran_teachers to trainers
-- This is needed because we migrated teachers to the trainers table

-- Drop the old foreign key constraint
ALTER TABLE public.quran_circles 
DROP CONSTRAINT IF EXISTS quran_circles_teacher_id_fkey;

-- Add new foreign key referencing trainers table
ALTER TABLE public.quran_circles 
ADD CONSTRAINT quran_circles_teacher_id_fkey 
FOREIGN KEY (teacher_id) REFERENCES public.trainers(id) ON DELETE SET NULL;

-- Comment explaining the change
COMMENT ON COLUMN public.quran_circles.teacher_id IS 'References trainers table (type = quran_teacher)';
