-- Fix FK on quran_circles to point to quran_teachers instead of trainers

-- 1. Drop existing constraint
ALTER TABLE public.quran_circles
DROP CONSTRAINT IF EXISTS quran_circles_teacher_id_fkey;

-- 2. Add new constraint pointing to quran_teachers
ALTER TABLE public.quran_circles
ADD CONSTRAINT quran_circles_teacher_id_fkey
FOREIGN KEY (teacher_id)
REFERENCES public.quran_teachers(id)
ON DELETE SET NULL;
