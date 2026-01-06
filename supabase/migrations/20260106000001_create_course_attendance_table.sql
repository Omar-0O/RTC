-- Create course_attendance table
CREATE TABLE IF NOT EXISTS public.course_attendance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lecture_id UUID REFERENCES public.course_lectures(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    student_phone TEXT NOT NULL,
    status TEXT DEFAULT 'present' CHECK (status IN ('present', 'absent', 'excused')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.course_attendance ENABLE ROW LEVEL SECURITY;

-- Policies for course_attendance
DROP POLICY IF EXISTS "View course attendance for heads" ON public.course_attendance;
CREATE POLICY "View course attendance for heads" ON public.course_attendance
    FOR SELECT USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles 
            WHERE role IN ('admin', 'supervisor', 'head_production', 'head_fourth_year', 'head_events', 'head_caravans', 'committee_leader')
        )
    );

DROP POLICY IF EXISTS "Manage course attendance for heads" ON public.course_attendance;
CREATE POLICY "Manage course attendance for heads" ON public.course_attendance
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles 
            WHERE role IN ('admin', 'supervisor', 'head_production', 'head_fourth_year', 'head_events', 'head_caravans', 'committee_leader')
        )
    );
