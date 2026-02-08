-- 1. Cascade quran_circles -> quran_teachers
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'quran_circles_teacher_id_fkey') THEN 
    ALTER TABLE public.quran_circles DROP CONSTRAINT quran_circles_teacher_id_fkey; 
  END IF; 
END $$;

ALTER TABLE public.quran_circles
ADD CONSTRAINT quran_circles_teacher_id_fkey
FOREIGN KEY (teacher_id)
REFERENCES public.quran_teachers(id)
ON DELETE CASCADE;

-- 2. Cascade quran_enrollments -> quran_circles
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'quran_enrollments_circle_id_fkey') THEN 
    ALTER TABLE public.quran_enrollments DROP CONSTRAINT quran_enrollments_circle_id_fkey; 
  END IF; 
END $$;

ALTER TABLE public.quran_enrollments
ADD CONSTRAINT quran_enrollments_circle_id_fkey
FOREIGN KEY (circle_id)
REFERENCES public.quran_circles(id)
ON DELETE CASCADE;

-- 3. Cascade quran_circle_organizers -> quran_circles
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'quran_circle_organizers_circle_id_fkey') THEN 
    ALTER TABLE public.quran_circle_organizers DROP CONSTRAINT quran_circle_organizers_circle_id_fkey; 
  END IF; 
END $$;

ALTER TABLE public.quran_circle_organizers
ADD CONSTRAINT quran_circle_organizers_circle_id_fkey
FOREIGN KEY (circle_id)
REFERENCES public.quran_circles(id)
ON DELETE CASCADE;

-- 4. Cascade quran_circle_sessions -> quran_circles
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'quran_circle_sessions_circle_id_fkey') THEN 
    ALTER TABLE public.quran_circle_sessions DROP CONSTRAINT quran_circle_sessions_circle_id_fkey; 
  END IF; 
END $$;

ALTER TABLE public.quran_circle_sessions
ADD CONSTRAINT quran_circle_sessions_circle_id_fkey
FOREIGN KEY (circle_id)
REFERENCES public.quran_circles(id)
ON DELETE CASCADE;

-- 5. Cascade quran_circle_beneficiaries -> quran_circles (and sessions)
-- Note: It also references quran_circle_sessions(id) via quran_circle_beneficiaries_session_id_fkey
-- Deleting quran_circle_sessions should trigger deletion here too.

DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'quran_circle_beneficiaries_circle_id_fkey') THEN 
    ALTER TABLE public.quran_circle_beneficiaries DROP CONSTRAINT quran_circle_beneficiaries_circle_id_fkey; 
  END IF; 
END $$;

ALTER TABLE public.quran_circle_beneficiaries
ADD CONSTRAINT quran_circle_beneficiaries_circle_id_fkey
FOREIGN KEY (circle_id)
REFERENCES public.quran_circles(id)
ON DELETE CASCADE;

DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'quran_circle_beneficiaries_session_id_fkey') THEN 
    ALTER TABLE public.quran_circle_beneficiaries DROP CONSTRAINT quran_circle_beneficiaries_session_id_fkey; 
  END IF; 
END $$;

ALTER TABLE public.quran_circle_beneficiaries
ADD CONSTRAINT quran_circle_beneficiaries_session_id_fkey
FOREIGN KEY (session_id)
REFERENCES public.quran_circle_sessions(id)
ON DELETE CASCADE;
