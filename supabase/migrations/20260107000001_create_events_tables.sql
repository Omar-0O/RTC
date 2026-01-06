-- Create events table (separate from caravans)
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- Free text field for event type
    location TEXT NOT NULL,
    date DATE NOT NULL,
    time TIME,
    description TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create event_participants table
CREATE TABLE IF NOT EXISTS public.event_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    volunteer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    is_volunteer BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;

-- Events Policies
CREATE POLICY "events_select_policy" ON public.events
    FOR SELECT USING (true); -- Everyone can view events

CREATE POLICY "events_insert_policy" ON public.events
    FOR INSERT WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM public.user_roles
            WHERE role IN ('admin', 'head_events', 'supervisor')
        )
    );

CREATE POLICY "events_update_policy" ON public.events
    FOR UPDATE USING (
        auth.uid() IN (
            SELECT user_id FROM public.user_roles
            WHERE role IN ('admin', 'head_events', 'supervisor')
        )
    );

CREATE POLICY "events_delete_policy" ON public.events
    FOR DELETE USING (
        auth.uid() IN (
            SELECT user_id FROM public.user_roles
            WHERE role IN ('admin', 'head_events', 'supervisor')
        )
    );

-- Event Participants Policies
CREATE POLICY "event_participants_select_policy" ON public.event_participants
    FOR SELECT USING (true);

CREATE POLICY "event_participants_insert_policy" ON public.event_participants
    FOR INSERT WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM public.user_roles
            WHERE role IN ('admin', 'head_events', 'supervisor')
        )
    );

CREATE POLICY "event_participants_delete_policy" ON public.event_participants
    FOR DELETE USING (
        auth.uid() IN (
            SELECT user_id FROM public.user_roles
            WHERE role IN ('admin', 'head_events', 'supervisor')
        )
    );
