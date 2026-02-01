-- Create table to track individual surah progress for each beneficiary
CREATE TABLE public.beneficiary_surah_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    beneficiary_id UUID REFERENCES public.quran_beneficiaries(id) ON DELETE CASCADE NOT NULL,
    surah_number INTEGER NOT NULL CHECK (surah_number >= 1 AND surah_number <= 114),
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'revision')),
    from_ayah INTEGER DEFAULT 1,
    to_ayah INTEGER,
    notes TEXT,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(beneficiary_id, surah_number)
);

-- Enable RLS
ALTER TABLE public.beneficiary_surah_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow read access for admin and head_quran"
ON public.beneficiary_surah_progress FOR SELECT TO authenticated
USING ((SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) IN ('admin', 'head_quran'));

CREATE POLICY "Allow write access for admin and head_quran"
ON public.beneficiary_surah_progress FOR ALL TO authenticated
USING ((SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) IN ('admin', 'head_quran'))
WITH CHECK ((SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) IN ('admin', 'head_quran'));

-- Add index for faster lookups
CREATE INDEX idx_beneficiary_surah_progress_beneficiary_id ON public.beneficiary_surah_progress(beneficiary_id);
