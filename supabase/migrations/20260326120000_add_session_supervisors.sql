-- Add multi-supervisor support for Quran circle sessions
-- Replaces single organizer_id with a many-to-many junction table

CREATE TABLE IF NOT EXISTS public.quran_session_supervisors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES public.quran_circle_sessions(id) ON DELETE CASCADE NOT NULL,
    organizer_id UUID REFERENCES public.quran_circle_organizers(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(session_id, organizer_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_session_supervisors_session_id ON public.quran_session_supervisors(session_id);
CREATE INDEX IF NOT EXISTS idx_session_supervisors_organizer_id ON public.quran_session_supervisors(organizer_id);

-- Enable RLS
ALTER TABLE public.quran_session_supervisors ENABLE ROW LEVEL SECURITY;

-- Admins and head_quran can do anything
CREATE POLICY "Admins can manage session supervisors"
ON public.quran_session_supervisors
FOR ALL
USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'head_quran')
);

-- Circle organizers can read and write session supervisors for their circles
CREATE POLICY "Circle organizers can manage session supervisors"
ON public.quran_session_supervisors
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.quran_circle_sessions s
        JOIN public.quran_circle_organizers o ON o.circle_id = s.circle_id
        WHERE s.id = quran_session_supervisors.session_id
          AND o.volunteer_id = auth.uid()
    )
);
