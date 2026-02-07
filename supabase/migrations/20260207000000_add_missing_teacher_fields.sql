-- Add missing columns to quran_teachers
ALTER TABLE public.quran_teachers ADD COLUMN IF NOT EXISTS specialization text;
ALTER TABLE public.quran_teachers ADD COLUMN IF NOT EXISTS teaching_mode text DEFAULT 'both';
ALTER TABLE public.quran_teachers ADD COLUMN IF NOT EXISTS target_gender text DEFAULT 'men';

-- Link to profiles (user_id) if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quran_teachers' AND column_name='user_id') THEN
        ALTER TABLE public.quran_teachers ADD COLUMN user_id uuid REFERENCES public.profiles(id);
    END IF;
END $$;

-- Update updated_at if it's missing (though it was in types.ts)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quran_teachers' AND column_name='updated_at') THEN
        ALTER TABLE public.quran_teachers ADD COLUMN updated_at timestamp with time zone DEFAULT timezone('utc'::text, now());
    END IF;
END $$;

-- Reload PostgREST cache
NOTIFY pgrst, 'reload config';
