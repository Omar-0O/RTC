-- Create caravans table
CREATE TABLE IF NOT EXISTS public.caravans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    location TEXT NOT NULL,
    date DATE NOT NULL,
    move_time TIME,
    actual_move_time TIME,
    bus_arrival_time TIME,
    return_time TIME,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create caravan_participants table
CREATE TABLE IF NOT EXISTS public.caravan_participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    caravan_id UUID REFERENCES public.caravans(id) ON DELETE CASCADE,
    volunteer_id UUID REFERENCES public.profiles(id),
    name TEXT NOT NULL,
    phone TEXT,
    is_volunteer BOOLEAN DEFAULT FALSE,
    role TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.caravans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caravan_participants ENABLE ROW LEVEL SECURITY;

-- Policies for caravans
-- Policies for caravans
DROP POLICY IF EXISTS "View caravans for everyone" ON public.caravans;
CREATE POLICY "View caravans for everyone" ON public.caravans
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Manage caravans for head_caravans and admin" ON public.caravans;
CREATE POLICY "Manage caravans for head_caravans and admin" ON public.caravans
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles 
            WHERE role IN ('admin', 'head_caravans', 'supervisor', 'head_fourth_year')
        )
    );

-- Policies for caravan_participants
DROP POLICY IF EXISTS "View caravan participants for authorized users" ON public.caravan_participants;
CREATE POLICY "View caravan participants for authorized users" ON public.caravan_participants
    FOR SELECT USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles 
            WHERE role IN ('admin', 'head_caravans', 'supervisor', 'head_fourth_year')
        )
    );

DROP POLICY IF EXISTS "Manage caravan participants for head_caravans and admin" ON public.caravan_participants;
CREATE POLICY "Manage caravan participants for head_caravans and admin" ON public.caravan_participants
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM user_roles 
            WHERE role IN ('admin', 'head_caravans', 'supervisor', 'head_fourth_year')
        )
    );
