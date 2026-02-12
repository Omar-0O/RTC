-- ============================================================
-- Enhance Events: committee linkage, speakers, organizers, beneficiaries
-- ============================================================

-- 1. Add committee_id to events
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS committee_id UUID REFERENCES public.committees(id) ON DELETE SET NULL;

-- 2. Create event_speakers table
CREATE TABLE IF NOT EXISTS public.event_speakers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    social_media_link TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.event_speakers ENABLE ROW LEVEL SECURITY;

-- 3. Create event_organizers table
CREATE TABLE IF NOT EXISTS public.event_organizers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    volunteer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(event_id, volunteer_id)
);
ALTER TABLE public.event_organizers ENABLE ROW LEVEL SECURITY;

-- 4. Create event_beneficiaries table
CREATE TABLE IF NOT EXISTS public.event_beneficiaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.event_beneficiaries ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper function: map head role to committee name
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_committee_name_for_role(role_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN CASE role_name
        WHEN 'head_events' THEN 'Events'
        WHEN 'head_caravans' THEN 'Caravans'
        WHEN 'head_ethics' THEN 'Ethics'
        WHEN 'head_quran' THEN 'Quran'
        WHEN 'head_ashbal' THEN 'Ashbal'
        WHEN 'head_marketing' THEN 'Marketing'
        WHEN 'head_production' THEN 'Production'
        WHEN 'head_fourth_year' THEN 'Fourth Year'
        WHEN 'head_hr' THEN 'HR'
        ELSE NULL
    END;
END;
$$;

-- ============================================================
-- Helper function: check if user is a head role for a given event's committee
-- ============================================================
CREATE OR REPLACE FUNCTION public.user_can_manage_event(event_committee_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r RECORD;
    mapped_committee TEXT;
BEGIN
    -- Admins, supervisors, head_events can manage ALL events
    IF EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role::TEXT IN ('admin', 'supervisor', 'head_events')
    ) THEN
        RETURN TRUE;
    END IF;

    -- Other head roles can manage events for their committee
    FOR r IN SELECT role::TEXT AS role_name FROM public.user_roles WHERE user_id = auth.uid() LOOP
        mapped_committee := get_committee_name_for_role(r.role_name);
        IF mapped_committee IS NOT NULL THEN
            IF EXISTS (
                SELECT 1 FROM public.committees 
                WHERE id = event_committee_id AND name = mapped_committee
            ) THEN
                RETURN TRUE;
            END IF;
        END IF;
    END LOOP;

    RETURN FALSE;
END;
$$;

-- ============================================================
-- RLS Policies for events (update existing)
-- ============================================================

-- Everyone can view events
DROP POLICY IF EXISTS "Anyone can view events" ON public.events;
CREATE POLICY "Anyone can view events" ON public.events
    FOR SELECT USING (true);

-- Heads can manage events (replaces old policy)
DROP POLICY IF EXISTS "Heads can manage events" ON public.events;
DROP POLICY IF EXISTS "Heads can insert events" ON public.events;
DROP POLICY IF EXISTS "Heads can update events" ON public.events;
DROP POLICY IF EXISTS "Heads can delete events" ON public.events;
DROP POLICY IF EXISTS "Admin and head_events can manage events" ON public.events;

CREATE POLICY "Heads can insert events" ON public.events
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role::TEXT IN ('admin', 'supervisor', 'head_events', 'head_caravans', 'head_ethics', 'head_quran', 'head_ashbal', 'head_marketing', 'head_production', 'head_fourth_year', 'head_hr')
        )
    );

CREATE POLICY "Heads can update events" ON public.events
    FOR UPDATE USING (
        public.user_can_manage_event(committee_id)
    );

CREATE POLICY "Heads can delete events" ON public.events
    FOR DELETE USING (
        public.user_can_manage_event(committee_id)
    );

-- ============================================================
-- RLS Policies for event_speakers
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view event speakers" ON public.event_speakers;
CREATE POLICY "Anyone can view event speakers" ON public.event_speakers
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Heads can manage event speakers" ON public.event_speakers;
CREATE POLICY "Heads can manage event speakers" ON public.event_speakers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.id = event_speakers.event_id
            AND public.user_can_manage_event(e.committee_id)
        )
    );

-- Organizers can manage speakers for their events
DROP POLICY IF EXISTS "Organizers can manage event speakers" ON public.event_speakers;
CREATE POLICY "Organizers can manage event speakers" ON public.event_speakers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.event_organizers eo
            WHERE eo.event_id = event_speakers.event_id
            AND eo.volunteer_id = auth.uid()
        )
    );

-- ============================================================
-- RLS Policies for event_organizers
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view event organizers" ON public.event_organizers;
CREATE POLICY "Anyone can view event organizers" ON public.event_organizers
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Heads can manage event organizers" ON public.event_organizers;
CREATE POLICY "Heads can manage event organizers" ON public.event_organizers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.id = event_organizers.event_id
            AND public.user_can_manage_event(e.committee_id)
        )
    );

-- Organizers can view their own records
DROP POLICY IF EXISTS "Organizers can view own records" ON public.event_organizers;
CREATE POLICY "Organizers can view own records" ON public.event_organizers
    FOR SELECT USING (volunteer_id = auth.uid());

-- ============================================================
-- RLS Policies for event_beneficiaries
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view event beneficiaries" ON public.event_beneficiaries;
CREATE POLICY "Anyone can view event beneficiaries" ON public.event_beneficiaries
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Heads can manage event beneficiaries" ON public.event_beneficiaries;
CREATE POLICY "Heads can manage event beneficiaries" ON public.event_beneficiaries
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.id = event_beneficiaries.event_id
            AND public.user_can_manage_event(e.committee_id)
        )
    );

-- Organizers can manage beneficiaries for their events
DROP POLICY IF EXISTS "Organizers can manage event beneficiaries" ON public.event_beneficiaries;
CREATE POLICY "Organizers can manage event beneficiaries" ON public.event_beneficiaries
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.event_organizers eo
            WHERE eo.event_id = event_beneficiaries.event_id
            AND eo.volunteer_id = auth.uid()
        )
    );

-- ============================================================
-- Update event_participants RLS to also allow head roles
-- ============================================================
DROP POLICY IF EXISTS "Heads can manage event participants" ON public.event_participants;
CREATE POLICY "Heads can manage event participants" ON public.event_participants
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.id = event_participants.event_id
            AND public.user_can_manage_event(e.committee_id)
        )
    );

-- Organizers can manage participants for their events
DROP POLICY IF EXISTS "Organizers can manage event participants" ON public.event_participants;
CREATE POLICY "Organizers can manage event participants" ON public.event_participants
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.event_organizers eo
            WHERE eo.event_id = event_participants.event_id
            AND eo.volunteer_id = auth.uid()
        )
    );

-- ============================================================
-- Update log_event_participation trigger to use event's committee_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_event_participation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event_name TEXT;
    v_committee_id UUID;
    v_activity_type_id UUID;
BEGIN
    -- Only log for volunteers
    IF NEW.is_volunteer IS NOT TRUE OR NEW.volunteer_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get event info including committee_id
    SELECT name, committee_id INTO v_event_name, v_committee_id
    FROM public.events WHERE id = NEW.event_id;

    -- Fallback: if event has no committee_id, use Events committee
    IF v_committee_id IS NULL THEN
        SELECT id INTO v_committee_id FROM public.committees WHERE name = 'Events' LIMIT 1;
    END IF;

    -- Get or create Event activity type
    SELECT id INTO v_activity_type_id FROM public.activity_types WHERE name = 'Event' LIMIT 1;
    IF v_activity_type_id IS NULL THEN
        INSERT INTO public.activity_types (name, name_ar, points, description)
        VALUES ('Event', 'ايفنت', 5, 'Event participation')
        RETURNING id INTO v_activity_type_id;
    END IF;

    -- Insert activity submission
    INSERT INTO public.activity_submissions (
        volunteer_id, activity_type_id, committee_id,
        description, status, points_awarded, submitted_at
    ) VALUES (
        NEW.volunteer_id, v_activity_type_id, v_committee_id,
        'ايفنت: ' || COALESCE(v_event_name, 'Unknown'),
        'approved', 5, NOW()
    );

    RETURN NEW;
END;
$$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_event_speakers_event_id ON public.event_speakers(event_id);
CREATE INDEX IF NOT EXISTS idx_event_organizers_event_id ON public.event_organizers(event_id);
CREATE INDEX IF NOT EXISTS idx_event_organizers_volunteer_id ON public.event_organizers(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_event_beneficiaries_event_id ON public.event_beneficiaries(event_id);
CREATE INDEX IF NOT EXISTS idx_events_committee_id ON public.events(committee_id);
