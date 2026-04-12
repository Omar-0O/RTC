-- Create unified_users table to collect all types of users
CREATE TABLE IF NOT EXISTS public.unified_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    user_type TEXT NOT NULL,
    source_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name, phone, user_type)
);

-- Note: We use ON CONFLICT ON CONSTRAINT to avoid duplicates if migration is run multiple times

-- 1. Volunteers (متطوعين) and Ashbal (اشبال)
INSERT INTO public.unified_users (name, phone, user_type, source_id, created_at)
SELECT 
    COALESCE(full_name, 'Unknown'), 
    phone, 
    CASE WHEN is_ashbal = true THEN 'شبل' ELSE 'متطوع' END, 
    id, 
    created_at
FROM public.profiles
ON CONFLICT (name, phone, user_type) DO NOTHING;

-- 2. Trainers (مدربين)
INSERT INTO public.unified_users (name, phone, user_type, source_id, created_at)
SELECT 
    COALESCE(name_ar, name_en, 'Unknown'), 
    phone, 
    'مدرب', 
    id, 
    created_at
FROM public.trainers
ON CONFLICT (name, phone, user_type) DO NOTHING;

-- 3. Memorizers / Quran Teachers (محفظين)
INSERT INTO public.unified_users (name, phone, user_type, source_id, created_at)
SELECT 
    COALESCE(name, 'Unknown'), 
    phone, 
    'محفظ', 
    id, 
    created_at
FROM public.quran_teachers
ON CONFLICT (name, phone, user_type) DO NOTHING;

-- 4. Newcomers (جدد)
INSERT INTO public.unified_users (name, phone, user_type, source_id, created_at)
SELECT 
    COALESCE(name, 'Unknown'), 
    phone, 
    'جديد', 
    id, 
    created_at
FROM public.interested_beneficiaries
ON CONFLICT (name, phone, user_type) DO NOTHING;

-- 5. Guests (ضيوف)
INSERT INTO public.unified_users (name, phone, user_type, created_at)
SELECT 
    guest_name, 
    MAX(guest_phone), 
    'ضيف', 
    MIN(created_at)
FROM public.activity_submissions 
WHERE participant_type = 'guest' 
  AND guest_name IS NOT NULL
GROUP BY guest_name, guest_phone
ON CONFLICT (name, phone, user_type) DO NOTHING;
