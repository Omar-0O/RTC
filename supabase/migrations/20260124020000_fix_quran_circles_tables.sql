-- Ensure quran_circles table exists
CREATE TABLE IF NOT EXISTS public.quran_circles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    guest_names JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure quran_circle_beneficiaries table exists
CREATE TABLE IF NOT EXISTS public.quran_circle_beneficiaries (
    circle_id UUID REFERENCES public.quran_circles(id) ON DELETE CASCADE,
    beneficiary_id UUID REFERENCES public.quran_beneficiaries(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (circle_id, beneficiary_id)
);

-- Ensure attendance_type column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'quran_circle_beneficiaries'
        AND column_name = 'attendance_type'
    ) THEN
        ALTER TABLE public.quran_circle_beneficiaries
        ADD COLUMN attendance_type TEXT NOT NULL DEFAULT 'memorization'
        CHECK (attendance_type IN ('memorization', 'revision'));
    END IF;
END $$;
