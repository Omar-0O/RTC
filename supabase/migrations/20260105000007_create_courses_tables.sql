-- Create courses table
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    trainer_name TEXT NOT NULL,
    trainer_phone TEXT,
    room TEXT NOT NULL CHECK (room IN ('lab_1', 'lab_2', 'lab_3', 'lab_4', 'impact_hall')),
    schedule_days TEXT[] NOT NULL,
    schedule_time TIME NOT NULL,
    has_interview BOOLEAN DEFAULT FALSE,
    interview_date DATE,
    total_lectures INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    created_by UUID REFERENCES public.profiles(id),
    committee_id UUID REFERENCES public.committees(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create course_organizers table
CREATE TABLE IF NOT EXISTS public.course_organizers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create course_lectures table
CREATE TABLE IF NOT EXISTS public.course_lectures (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    lecture_number INTEGER NOT NULL,
    date DATE NOT NULL,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_organizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lectures ENABLE ROW LEVEL SECURITY;

-- Policies for courses
DROP POLICY IF EXISTS "View courses for everyone" ON public.courses;
CREATE POLICY "View courses for everyone" ON public.courses
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Manage courses for heads" ON public.courses;
CREATE POLICY "Manage courses for heads" ON public.courses
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles 
            WHERE role IN ('admin', 'supervisor', 'head_production', 'head_fourth_year', 'head_events', 'head_caravans', 'committee_leader')
        )
    );

-- Policies for course_organizers
DROP POLICY IF EXISTS "View course organizers for heads" ON public.course_organizers;
CREATE POLICY "View course organizers for heads" ON public.course_organizers
    FOR SELECT USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles 
            WHERE role IN ('admin', 'supervisor', 'head_production', 'head_fourth_year', 'head_events', 'head_caravans', 'committee_leader')
        )
    );

DROP POLICY IF EXISTS "Manage course organizers for heads" ON public.course_organizers;
CREATE POLICY "Manage course organizers for heads" ON public.course_organizers
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles 
            WHERE role IN ('admin', 'supervisor', 'head_production', 'head_fourth_year', 'head_events', 'head_caravans', 'committee_leader')
        )
    );

-- Policies for course_lectures
DROP POLICY IF EXISTS "View course lectures for heads" ON public.course_lectures;
CREATE POLICY "View course lectures for heads" ON public.course_lectures
    FOR SELECT USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles 
            WHERE role IN ('admin', 'supervisor', 'head_production', 'head_fourth_year', 'head_events', 'head_caravans', 'committee_leader')
        )
    );

DROP POLICY IF EXISTS "Manage course lectures for heads" ON public.course_lectures;
CREATE POLICY "Manage course lectures for heads" ON public.course_lectures
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles 
            WHERE role IN ('admin', 'supervisor', 'head_production', 'head_fourth_year', 'head_events', 'head_caravans', 'committee_leader')
        )
    );
