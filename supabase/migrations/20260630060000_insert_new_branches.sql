-- 1. Ensure the default branch (المهندسين) has code = 'ma'
UPDATE public.branches
SET code = 'ma'
WHERE name = 'Mohandeseen' OR name_ar = 'المهندسين';

-- 2. Insert Faisal branch if not exists
INSERT INTO public.branches (name, name_ar, code, is_default)
SELECT 'Faisal', 'فيصل', 'fs', false
WHERE NOT EXISTS (
  SELECT 1 FROM public.branches WHERE name = 'Faisal' OR code = 'fs'
);

-- 3. Insert Nasr City branch if not exists
INSERT INTO public.branches (name, name_ar, code, is_default)
SELECT 'Nasr City', 'مدينة نصر', 'nc', false
WHERE NOT EXISTS (
  SELECT 1 FROM public.branches WHERE name = 'Nasr City' OR code = 'nc'
);
