-- Create interested_beneficiaries table
-- Stores beneficiaries collected from courses or entered manually
-- Categorized by committee type (production / quran) and gender+age group

CREATE TABLE IF NOT EXISTS public.interested_beneficiaries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    committee_category TEXT NOT NULL CHECK (committee_category IN ('production', 'quran')),
    gender_age_group TEXT NOT NULL CHECK (gender_age_group IN ('adult_male', 'adult_female', 'child_male', 'child_female')),
    notes TEXT,
    source_course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent duplicate phone in the same category+group
CREATE UNIQUE INDEX IF NOT EXISTS interested_beneficiaries_unique_idx
ON public.interested_beneficiaries(phone, committee_category, gender_age_group);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_interested_beneficiaries_category
ON public.interested_beneficiaries(committee_category);

CREATE INDEX IF NOT EXISTS idx_interested_beneficiaries_group
ON public.interested_beneficiaries(gender_age_group);

CREATE INDEX IF NOT EXISTS idx_interested_beneficiaries_source
ON public.interested_beneficiaries(source_course_id);

-- Enable RLS
ALTER TABLE public.interested_beneficiaries ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
DROP POLICY IF EXISTS "interested_beneficiaries_admin_all" ON public.interested_beneficiaries;
CREATE POLICY "interested_beneficiaries_admin_all" ON public.interested_beneficiaries
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );
