-- Revamp Quran System Schema

-- 1. Link Teachers to Volunteers (Profiles)
ALTER TABLE public.quran_teachers
ADD COLUMN IF NOT EXISTS volunteer_id UUID REFERENCES public.profiles(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_quran_teachers_volunteer ON public.quran_teachers(volunteer_id);

-- 2. Create Enrollments Table
CREATE TABLE IF NOT EXISTS public.quran_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES public.quran_circles(id) ON DELETE CASCADE,
    beneficiary_id UUID NOT NULL REFERENCES public.quran_beneficiaries(id) ON DELETE CASCADE,
    enrollment_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'transferred')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate active enrollments for the same beneficiary (optional, but good practice)
    -- A student can be in multiple circles? Usually no, but let's allow flexibility but warn in UI.
    -- For now, let's just ensure unique pair per circle.
    UNIQUE(circle_id, beneficiary_id)
);

-- Enable RLS
ALTER TABLE public.quran_enrollments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admin/Head: Full Access
CREATE POLICY "Full access for admin and head" ON public.quran_enrollments
FOR ALL TO authenticated
USING ((SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) IN ('admin', 'head_quran', 'supervisor'))
WITH CHECK ((SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) IN ('admin', 'head_quran', 'supervisor'));

-- Organizers: View their own circle enrollments
CREATE POLICY "Organizers view their enrollments" ON public.quran_enrollments
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.quran_circles c
        JOIN public.quran_circle_organizers o ON o.circle_id = c.id
        WHERE c.id = quran_enrollments.circle_id AND o.volunteer_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM public.quran_circles c
        JOIN public.quran_teachers t ON c.teacher_id = t.id
        WHERE c.id = quran_enrollments.circle_id AND t.volunteer_id = auth.uid() -- Teacher is also an organizer implicit
    )
);

-- Organizers: Add/Remove enrollments (if needed, usually admin does this, but maybe organizer too?)
-- Let's allow organizers to manage enrollments for now.
CREATE POLICY "Organizers manage their enrollments" ON public.quran_enrollments
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.quran_circles c
        JOIN public.quran_circle_organizers o ON o.circle_id = c.id
        WHERE c.id = circle_id AND o.volunteer_id = auth.uid()
    )
);

CREATE POLICY "Organizers update their enrollments" ON public.quran_enrollments
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.quran_circles c
        JOIN public.quran_circle_organizers o ON o.circle_id = c.id
        WHERE c.id = circle_id AND o.volunteer_id = auth.uid()
    )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_enrollments_circle ON public.quran_enrollments(circle_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_beneficiary ON public.quran_enrollments(beneficiary_id);

-- Optional: Migrate existing attendance to enrollments?
-- If a beneficiary has attendance in a circle session, enroll them in that circle.
INSERT INTO public.quran_enrollments (circle_id, beneficiary_id, enrollment_date)
SELECT DISTINCT s.circle_id, b.beneficiary_id, MIN(s.session_date)
FROM public.quran_circle_beneficiaries b
JOIN public.quran_circle_sessions s ON b.session_id = s.id
GROUP BY s.circle_id, b.beneficiary_id
ON CONFLICT (circle_id, beneficiary_id) DO NOTHING;
