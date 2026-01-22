-- Create competition tables for Ethics Publishing feature

-- Competition participants (المشاركين بالمسابقة)
CREATE TABLE IF NOT EXISTS public.competition_participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Competition entries (المشاركات/الإنجازات)
CREATE TABLE IF NOT EXISTS public.competition_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    participant_id UUID NOT NULL REFERENCES public.competition_participants(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.competition_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_entries ENABLE ROW LEVEL SECURITY;

-- View for everyone
DROP POLICY IF EXISTS "View competition_participants" ON public.competition_participants;
CREATE POLICY "View competition_participants" ON public.competition_participants
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "View competition_entries" ON public.competition_entries;
CREATE POLICY "View competition_entries" ON public.competition_entries
    FOR SELECT USING (true);

-- Manage for head_ethics, admin, supervisor
DROP POLICY IF EXISTS "Manage competition_participants" ON public.competition_participants;
CREATE POLICY "Manage competition_participants" ON public.competition_participants
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles 
            WHERE role IN ('admin', 'supervisor', 'head_ethics')
        )
    );

DROP POLICY IF EXISTS "Manage competition_entries" ON public.competition_entries;
CREATE POLICY "Manage competition_entries" ON public.competition_entries
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles 
            WHERE role IN ('admin', 'supervisor', 'head_ethics')
        )
    );

-- Comments
COMMENT ON TABLE public.competition_participants IS 'Individual competition participants for ethics publishing';
COMMENT ON TABLE public.competition_entries IS 'Entries/achievements for competition participants';
