-- Create calls/outreach tables for Ethics Publishing feature

-- Calls/Outreach visits (النزولات)
CREATE TABLE IF NOT EXISTS public.ethics_calls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    calls_count INTEGER DEFAULT 0,
    drive_link TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calls participants (المشاركين فالنزولة)
CREATE TABLE IF NOT EXISTS public.ethics_calls_participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    call_id UUID NOT NULL REFERENCES public.ethics_calls(id) ON DELETE CASCADE,
    volunteer_id UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    phone TEXT,
    is_volunteer BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.ethics_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ethics_calls_participants ENABLE ROW LEVEL SECURITY;

-- View for everyone
DROP POLICY IF EXISTS "View ethics_calls" ON public.ethics_calls;
CREATE POLICY "View ethics_calls" ON public.ethics_calls
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "View ethics_calls_participants" ON public.ethics_calls_participants;
CREATE POLICY "View ethics_calls_participants" ON public.ethics_calls_participants
    FOR SELECT USING (true);

-- Manage for head_ethics, admin, supervisor
DROP POLICY IF EXISTS "Manage ethics_calls" ON public.ethics_calls;
CREATE POLICY "Manage ethics_calls" ON public.ethics_calls
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles 
            WHERE role IN ('admin', 'supervisor', 'head_ethics')
        )
    );

DROP POLICY IF EXISTS "Manage ethics_calls_participants" ON public.ethics_calls_participants;
CREATE POLICY "Manage ethics_calls_participants" ON public.ethics_calls_participants
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles 
            WHERE role IN ('admin', 'supervisor', 'head_ethics')
        )
    );

-- Create "Ethics Publishing" activity type if not exists
INSERT INTO public.activity_types (name, name_ar, points, description, description_ar, committee_id)
SELECT 'Ethics Publishing', 'نشر اخلاقيات', 10, 'Participation in ethics calls outreach', 'المشاركة في نزولات نشر الاخلاقيات', '722d7feb-0b46-48a8-8652-75c1e1a8487a'
WHERE NOT EXISTS (
    SELECT 1 FROM public.activity_types WHERE name = 'Ethics Publishing'
);

-- Comments
COMMENT ON TABLE public.ethics_calls IS 'Ethics publishing outreach calls/visits';
COMMENT ON TABLE public.ethics_calls_participants IS 'Participants in ethics calls outreach';
