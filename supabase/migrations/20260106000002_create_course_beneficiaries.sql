-- Create course_beneficiaries table for storing registered students per course
CREATE TABLE IF NOT EXISTS public.course_beneficiaries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id)
);

-- Create unique constraint for phone per course (one student can only register once per course)
CREATE UNIQUE INDEX IF NOT EXISTS course_beneficiaries_course_phone_idx 
ON public.course_beneficiaries(course_id, phone);

-- Enable RLS
ALTER TABLE public.course_beneficiaries ENABLE ROW LEVEL SECURITY;

-- Policies for course_beneficiaries
DROP POLICY IF EXISTS "View course beneficiaries for heads" ON public.course_beneficiaries;
CREATE POLICY "View course beneficiaries for heads" ON public.course_beneficiaries
    FOR SELECT USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles 
            WHERE role IN ('admin', 'supervisor', 'head_production', 'head_fourth_year', 'head_events', 'head_caravans', 'committee_leader')
        )
    );

DROP POLICY IF EXISTS "Manage course beneficiaries for heads" ON public.course_beneficiaries;
CREATE POLICY "Manage course beneficiaries for heads" ON public.course_beneficiaries
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles 
            WHERE role IN ('admin', 'supervisor', 'head_production', 'head_fourth_year', 'head_events', 'head_caravans', 'committee_leader')
        )
    );
