-- Add organizer_id to quran_circle_sessions
-- Allows tracking which supervisor (محفظ) ran a specific session when there are multiple per circle

ALTER TABLE public.quran_circle_sessions
ADD COLUMN IF NOT EXISTS organizer_id UUID REFERENCES public.quran_circle_organizers(id) ON DELETE SET NULL;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sessions_organizer_id ON public.quran_circle_sessions(organizer_id);
